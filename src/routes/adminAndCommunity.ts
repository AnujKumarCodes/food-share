import { Router } from 'express';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  auditLogs,
  complaints,
  contactMessages,
  contributions,
  donationClaims,
  donationImages,
  donations,
  donorProfiles,
  ngoProfiles,
  notifications,
  pickups,
  reviews,
  users,
  verifications,
  volunteerProfiles,
} from '../db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { createNotification, recordAuditLog } from '../services/notifications.ts';

const router = Router();

// Public DB-driven impact statistics, verified NGO partners, testimonials, and featured donations
router.get('/public/stats', async (_req, res) => {
  try {
    const [
      completedDonationsRows,
      verifiedNgoRows,
      volunteerCountRows,
      featuredRows,
      partnerNgos,
      recentReviews,
    ] = await Promise.all([
      db
        .select({
          totalQuantity: donations.totalQuantity,
          quantityUnit: donations.quantityUnit,
          status: donations.status,
        })
        .from(donations)
        .where(inArray(donations.status, ['Completed', 'Delivered'])),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(ngoProfiles)
        .where(eq(ngoProfiles.verificationStatus, 'approved')),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(users)
        .where(eq(users.role, 'volunteer')),
      db
        .select()
        .from(donations)
        .where(
          and(
            inArray(donations.status, ['Available', 'Partially Claimed']),
            eq(donations.unsafeFlagged, false)
          )
        )
        .orderBy(desc(donations.createdAt))
        .limit(6),
      db
        .select({
          organizationName: ngoProfiles.organizationName,
          city: ngoProfiles.city,
          dailyCapacityMeals: ngoProfiles.dailyCapacityMeals,
        })
        .from(ngoProfiles)
        .where(eq(ngoProfiles.verificationStatus, 'approved'))
        .limit(8),
      db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
          reviewerName: users.fullName,
          reviewerRole: users.role,
        })
        .from(reviews)
        .innerJoin(users, eq(reviews.reviewerId, users.id))
        .orderBy(desc(reviews.createdAt))
        .limit(4),
    ]);

    const totalFoodRescuedKg = completedDonationsRows.reduce((sum, item) => {
      if (item.quantityUnit === 'kg' || item.quantityUnit === 'liters') return sum + item.totalQuantity;
      if (item.quantityUnit === 'meals') return sum + item.totalQuantity * 0.4;
      return sum + item.totalQuantity * 2;
    }, 0);

    const featuredIds = featuredRows.map((d) => d.id);
    const featuredImages = featuredIds.length
      ? await db.select().from(donationImages).where(inArray(donationImages.donationId, featuredIds))
      : [];

    const featuredDonations = featuredRows.map((d) => ({
      id: d.id,
      foodName: d.foodName,
      category: d.category,
      remainingQuantity: d.remainingQuantity,
      quantityUnit: d.quantityUnit,
      city: d.city,
      pinCode: d.pinCode,
      dietaryType: d.dietaryType,
      collectionDeadline: d.collectionDeadline,
      status: d.status,
      images: featuredImages
        .filter((i) => i.donationId === d.id)
        .map((i) => ({ id: i.id, imageUrl: i.imageUrl, isPrimary: i.isPrimary })),
    }));

    return res.json({
      stats: {
        totalFoodRescuedKg: Number(totalFoodRescuedKg.toFixed(1)),
        totalDonationsCompleted: completedDonationsRows.length,
        ngoPartnersCount: verifiedNgoRows[0]?.count || 0,
        volunteersCount: volunteerCountRows[0]?.count || 0,
      },
      featuredDonations,
      partnerNgos,
      testimonials: recentReviews,
    });
  } catch (error) {
    console.error('Public stats error:', error);
    return res.status(500).json({ error: 'Failed to load impact statistics.' });
  }
});

// Contact form persistence
router.post('/contact', async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(2),
      email: z.string().email(),
      topic: z.string().min(2).max(100),
      message: z.string().min(10).max(2000),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please complete all contact form fields.' });
    }

    const [saved] = await db.insert(contactMessages).values(parsed.data).returning();
    return res.status(201).json({
      id: saved.id,
      message: 'Thank you for reaching out. Our partnerships and support team will respond shortly.',
    });
  } catch (error) {
    console.error('Contact submission error:', error);
    return res.status(500).json({ error: 'Failed to submit contact message.' });
  }
});

// Voluntary Contributions & CSR Sponsorships (Razorpay optional)
router.post('/contributions', async (req, res) => {
  try {
    const schema = z.object({
      supporterName: z.string().min(2),
      supporterEmail: z.string().email(),
      organizationName: z.string().optional().default(''),
      amountInr: z.coerce.number().int().min(50).max(5000000),
      contributionType: z.enum(['voluntary', 'csr_partnership', 'logistics_grant']).default('voluntary'),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid supporter details and amount (min ₹50) are required.' });
    }

    const rzpKey = process.env.RAZORPAY_KEY_ID;
    const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
    let razorpayOrderId: string | null = null;
    let status = 'pledged';

    if (rzpKey && rzpSecret) {
      const authHeader = Buffer.from(`${rzpKey}:${rzpSecret}`).toString('base64');
      const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parsed.data.amountInr * 100,
          currency: 'INR',
          receipt: `fs_${Date.now()}`,
        }),
      });
      if (rzpRes.ok) {
        const orderData = (await rzpRes.json()) as { id: string };
        razorpayOrderId = orderData.id;
        status = 'order_created';
      }
    }

    const [created] = await db
      .insert(contributions)
      .values({
        ...parsed.data,
        razorpayOrderId,
        status,
      })
      .returning();

    return res.status(201).json({
      contribution: created,
      razorpayConfigured: Boolean(rzpKey && rzpSecret),
      razorpayKeyId: rzpKey || null,
    });
  } catch (error) {
    console.error('Contribution error:', error);
    return res.status(500).json({ error: 'Failed to record contribution.' });
  }
});

// User Notifications
router.get('/notifications', requireAuth, async (req: AuthRequest, res) => {
  try {
    const items = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, req.user!.id))
      .orderBy(desc(notifications.createdAt))
      .limit(50);

    const unreadCount = items.filter((n) => !n.isRead).length;
    return res.json({ notifications: items, unreadCount });
  } catch (error) {
    console.error('Notifications fetch error:', error);
    return res.status(500).json({ error: 'Failed to load notifications.' });
  }
});

router.patch('/notifications/:id/read', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, req.user!.id)));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to update notification.' });
  }
});

router.post('/notifications/read-all', requireAuth, async (req: AuthRequest, res) => {
  try {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, req.user!.id));
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Failed to mark notifications read.' });
  }
});

// Reviews
router.post('/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      donationId: z.coerce.number().int().positive(),
      targetUserId: z.coerce.number().int().positive(),
      rating: z.coerce.number().int().min(1).max(5),
      comment: z.string().min(4).max(800),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid rating (1-5) and comment required.' });
    }

    const [created] = await db
      .insert(reviews)
      .values({
        donationId: parsed.data.donationId,
        reviewerId: req.user!.id,
        targetUserId: parsed.data.targetUserId,
        rating: parsed.data.rating,
        comment: parsed.data.comment.trim(),
      })
      .returning();

    return res.status(201).json({ review: created });
  } catch (error) {
    console.error('Review creation error:', error);
    return res.status(500).json({ error: 'Failed to submit review.' });
  }
});

// ==================== ADMIN ROUTES ====================

router.get('/admin/overview', requireAuth, requireRole('admin'), async (_req: AuthRequest, res) => {
  try {
    const [
      allUsers,
      allDonorProfs,
      allNgoProfs,
      allVolProfs,
      allDonations,
      allPickups,
      allComplaints,
      allVerifications,
      recentAudits,
    ] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          phone: users.phone,
          role: users.role,
          isEmailVerified: users.isEmailVerified,
          isVerified: users.isVerified,
          isSuspended: users.isSuspended,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt)),
      db.select().from(donorProfiles),
      db.select().from(ngoProfiles),
      db.select().from(volunteerProfiles),
      db.select().from(donations).orderBy(desc(donations.createdAt)),
      db.select().from(pickups).orderBy(desc(pickups.createdAt)),
      db.select().from(complaints).orderBy(desc(complaints.createdAt)),
      db.select().from(verifications).orderBy(desc(verifications.createdAt)),
      db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(50),
    ]);

    const overview = {
      totalUsers: allUsers.length,
      totalDonors: allUsers.filter((u) => u.role === 'donor').length,
      totalNgos: allUsers.filter((u) => u.role === 'ngo').length,
      totalVolunteers: allUsers.filter((u) => u.role === 'volunteer').length,
      totalDonations: allDonations.length,
      activeDonations: allDonations.filter((d) =>
        ['Available', 'Partially Claimed'].includes(d.status)
      ).length,
      completedDonations: allDonations.filter((d) =>
        ['Completed', 'Delivered'].includes(d.status)
      ).length,
      pendingPickups: allPickups.filter((p) => ['open', 'assigned'].includes(p.status)).length,
      expiredDonations: allDonations.filter((d) => d.status === 'Expired').length,
    };

    const enrichedUsers = allUsers.map((u) => ({
      ...u,
      donorProfile: allDonorProfs.find((p) => p.userId === u.id) || null,
      ngoProfile: allNgoProfs.find((p) => p.userId === u.id) || null,
      volunteerProfile: allVolProfs.find((p) => p.userId === u.id) || null,
    }));

    return res.json({
      overview,
      users: enrichedUsers,
      donations: allDonations,
      pickups: allPickups,
      complaints: allComplaints,
      verifications: allVerifications,
      auditLogs: recentAudits,
    });
  } catch (error) {
    console.error('Admin overview error:', error);
    return res.status(500).json({ error: 'Failed to load admin overview.' });
  }
});

router.post(
  '/admin/verifications/:userId/decision',
  requireAuth,
  requireRole('admin'),
  async (req: AuthRequest, res) => {
    try {
      const targetUserId = Number(req.params.userId);
      const decision = String(req.body?.decision || '');
      const notes = String(req.body?.notes || '').trim();

      if (!['approved', 'rejected'].includes(decision)) {
        return res.status(400).json({ error: 'Decision must be approved or rejected.' });
      }

      const [targetUser] = await db
        .select()
        .from(users)
        .where(eq(users.id, targetUserId))
        .limit(1);
      if (!targetUser) return res.status(404).json({ error: 'User not found.' });

      await db.transaction(async (tx) => {
        await tx
          .update(users)
          .set({ isVerified: decision === 'approved', updatedAt: new Date() })
          .where(eq(users.id, targetUserId));

        if (targetUser.role === 'ngo') {
          await tx
            .update(ngoProfiles)
            .set({
              verificationStatus: decision,
              rejectionReason: decision === 'rejected' ? notes || 'Did not meet verification criteria' : null,
              verifiedAt: decision === 'approved' ? new Date() : null,
              updatedAt: new Date(),
            })
            .where(eq(ngoProfiles.userId, targetUserId));
        } else if (targetUser.role === 'donor') {
          await tx
            .update(donorProfiles)
            .set({
              verifiedByAdmin: decision === 'approved',
              updatedAt: new Date(),
            })
            .where(eq(donorProfiles.userId, targetUserId));
        }

        await tx
          .update(verifications)
          .set({
            status: decision,
            reviewedBy: req.user!.id,
            reviewNotes: notes,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(verifications.userId, targetUserId));
      });

      await createNotification({
        userId: targetUser.id,
        userEmail: targetUser.email,
        type: 'verification_update',
        title: `Account Verification ${decision === 'approved' ? 'Approved' : 'Rejected'}`,
        message:
          decision === 'approved'
            ? 'Your FoodShare organization verification has been approved. Full platform privileges are now active.'
            : `Your verification application was rejected. Reason: ${notes || 'Please update your registration details and contact support.'}`,
      });

      await recordAuditLog({
        actorId: req.user!.id,
        action: `VERIFICATION_${decision.toUpperCase()}`,
        targetType: 'user',
        targetId: targetUserId,
        details: { role: targetUser.role, notes },
        ipAddress: req.ip,
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error('Admin verification decision error:', error);
      return res.status(500).json({ error: 'Failed to update verification status.' });
    }
  }
);

router.patch(
  '/admin/users/:id/suspend',
  requireAuth,
  requireRole('admin'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const isSuspended = Boolean(req.body?.isSuspended);

      if (id === req.user!.id) {
        return res.status(400).json({ error: 'Cannot suspend your own admin account.' });
      }

      const [updated] = await db
        .update(users)
        .set({ isSuspended, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: 'User not found.' });

      await recordAuditLog({
        actorId: req.user!.id,
        action: isSuspended ? 'USER_SUSPENDED' : 'USER_REINSTATED',
        targetType: 'user',
        targetId: id,
        ipAddress: req.ip,
      });

      return res.json({ ok: true, isSuspended: updated.isSuspended });
    } catch (error) {
      console.error('Suspend user error:', error);
      return res.status(500).json({ error: 'Failed to update account suspension.' });
    }
  }
);

router.patch(
  '/admin/complaints/:id',
  requireAuth,
  requireRole('admin'),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const status = String(req.body?.status || 'resolved');
      const notes = String(req.body?.adminResolutionNotes || '').trim();

      const [updated] = await db
        .update(complaints)
        .set({ status, adminResolutionNotes: notes, updatedAt: new Date() })
        .where(eq(complaints.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: 'Complaint not found.' });

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'COMPLAINT_UPDATED',
        targetType: 'complaint',
        targetId: id,
        details: { status, notes },
        ipAddress: req.ip,
      });

      return res.json({ complaint: updated });
    } catch (error) {
      console.error('Update complaint error:', error);
      return res.status(500).json({ error: 'Failed to update complaint.' });
    }
  }
);

router.get(
  '/admin/export/donations.csv',
  requireAuth,
  requireRole('admin'),
  async (req: AuthRequest, res) => {
    try {
      const rows = await db
        .select({
          id: donations.id,
          foodName: donations.foodName,
          category: donations.category,
          totalQuantity: donations.totalQuantity,
          remainingQuantity: donations.remainingQuantity,
          quantityUnit: donations.quantityUnit,
          city: donations.city,
          pinCode: donations.pinCode,
          status: donations.status,
          collectionDeadline: donations.collectionDeadline,
          createdAt: donations.createdAt,
        })
        .from(donations)
        .orderBy(desc(donations.createdAt));

      const escapeCsv = (val: unknown) => {
        const str = String(val ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      };

      const header = [
        'ID',
        'Food Name',
        'Category',
        'Total Quantity',
        'Remaining Quantity',
        'Unit',
        'City',
        'PIN Code',
        'Status',
        'Collection Deadline',
        'Created At',
      ].join(',');

      const lines = rows.map((r) =>
        [
          r.id,
          escapeCsv(r.foodName),
          escapeCsv(r.category),
          r.totalQuantity,
          r.remainingQuantity,
          escapeCsv(r.quantityUnit),
          escapeCsv(r.city),
          escapeCsv(r.pinCode),
          escapeCsv(r.status),
          escapeCsv(r.collectionDeadline.toISOString()),
          escapeCsv(r.createdAt.toISOString()),
        ].join(',')
      );

      await recordAuditLog({
        actorId: req.user!.id,
        action: 'EXPORT_DONATIONS_CSV',
        targetType: 'report',
        details: { rowCount: rows.length },
        ipAddress: req.ip,
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="foodshare-donations-report.csv"');
      return res.send([header, ...lines].join('\n'));
    } catch (error) {
      console.error('CSV export error:', error);
      return res.status(500).json({ error: 'Failed to export CSV report.' });
    }
  }
);

// Suppress unused import warnings if any
void donationClaims;

export default router;
