import { Router } from 'express';
import { and, desc, eq, gte, ilike, inArray, lt, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  complaints,
  donationClaims,
  donationImages,
  donations,
  donorProfiles,
  ngoProfiles,
  pickups,
  users,
} from '../db/schema.ts';
import { AuthRequest, optionalAuth, requireAuth, requireRole } from '../middleware/auth.ts';
import { geocodeLocation } from '../services/geocoding.ts';
import { createNotification, recordAuditLog } from '../services/notifications.ts';

const router = Router();

export const FOOD_CATEGORIES = [
  'Cooked food',
  'Fruits',
  'Vegetables',
  'Bakery products',
  'Packaged food',
  'Dairy products',
  'Other',
] as const;

const createDonationSchema = z.object({
  foodName: z.string().min(2, 'Food name is required').max(150),
  category: z.enum(FOOD_CATEGORIES),
  description: z.string().min(5, 'Description is required').max(1500),
  totalQuantity: z.coerce.number().positive('Quantity must be greater than 0'),
  quantityUnit: z.enum(['kg', 'meals', 'boxes', 'trays', 'liters']),
  prepDate: z.string().min(4, 'Preparation date is required'),
  prepTime: z.string().min(2, 'Preparation time is required'),
  collectionDeadline: z.string().min(4, 'Collection deadline is required'),
  storageConditions: z.string().min(2, 'Storage conditions are required'),
  dietaryType: z.enum(['veg', 'non-veg', 'vegan']),
  allergenInfo: z.string().min(1, 'Allergen information is required'),
  fssaiSafetyAck: z.boolean().refine((val) => val === true, {
    message: 'You must confirm the food handling and FSSAI safety checklist.',
  }),
  pickupAddress: z.string().min(5, 'Pickup address is required'),
  city: z.string().min(2, 'City is required'),
  pinCode: z.string().min(4, 'PIN code is required').max(12),
  contactInfo: z.string().min(5, 'Contact information is required'),
  pickupInstructions: z.string().optional().default(''),
  imageUrl: z.string().optional(),
  publicId: z.string().optional(),
});

async function expireOverdueDonations() {
  const now = new Date();
  await db
    .update(donations)
    .set({ status: 'Expired', updatedAt: now })
    .where(
      and(
        inArray(donations.status, ['Available', 'Partially Claimed']),
        lt(donations.collectionDeadline, now)
      )
    );
}

function serializeDonationForViewer(
  row: typeof donations.$inferSelect,
  images: Array<typeof donationImages.$inferSelect>,
  donorName: string,
  donorOrg: string,
  viewer?: AuthRequest['user'],
  viewerHasClaim = false,
  viewerIsAssignedVolunteer = false,
  viewerIsApprovedNgo = false
) {
  const canSeeExactAddress =
    Boolean(viewer) &&
    (viewer!.role === 'admin' ||
      viewer!.id === row.donorId ||
      viewerHasClaim ||
      viewerIsAssignedVolunteer ||
      viewerIsApprovedNgo);

  return {
    id: row.id,
    donorId: row.donorId,
    donorName,
    donorOrganization: donorOrg,
    foodName: row.foodName,
    category: row.category,
    description: row.description,
    totalQuantity: row.totalQuantity,
    remainingQuantity: row.remainingQuantity,
    quantityUnit: row.quantityUnit,
    prepDate: row.prepDate,
    prepTime: row.prepTime,
    collectionDeadline: row.collectionDeadline,
    storageConditions: row.storageConditions,
    dietaryType: row.dietaryType,
    allergenInfo: row.allergenInfo,
    fssaiSafetyAck: row.fssaiSafetyAck,
    city: row.city,
    pinCode: row.pinCode,
    pickupAddress: canSeeExactAddress ? row.pickupAddress : 'Exact address unlocked for verified NGOs & assigned volunteers',
    contactInfo: canSeeExactAddress ? row.contactInfo : 'Protected until verified claim',
    pickupInstructions: canSeeExactAddress ? row.pickupInstructions : '',
    latitude: canSeeExactAddress ? row.latitude : Number(row.latitude.toFixed(2)),
    longitude: canSeeExactAddress ? row.longitude : Number(row.longitude.toFixed(2)),
    hasExactAccess: canSeeExactAddress,
    status: row.status,
    statusHistory: row.statusHistory,
    unsafeFlagged: row.unsafeFlagged,
    unsafeReason: row.unsafeReason,
    images: images.map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      isPrimary: img.isPrimary,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Public + Role-aware donation browse
router.get('/', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await expireOverdueDonations();

    const city = String(req.query.city || '').trim();
    const pinCode = String(req.query.pinCode || '').trim();
    const category = String(req.query.category || '').trim();
    const minQuantity = Number(req.query.minQuantity || 0);
    const deadlineBefore = String(req.query.deadlineBefore || '').trim();
    const dietaryType = String(req.query.dietaryType || '').trim();
    const search = String(req.query.search || '').trim();
    const includeAllStatuses = req.query.all === 'true';

    const conditions = [];
    if (!includeAllStatuses) {
      conditions.push(inArray(donations.status, ['Available', 'Partially Claimed']));
      conditions.push(gte(donations.collectionDeadline, new Date()));
      conditions.push(eq(donations.unsafeFlagged, false));
    }
    if (city) conditions.push(ilike(donations.city, `%${city}%`));
    if (pinCode) conditions.push(ilike(donations.pinCode, `%${pinCode}%`));
    if (category && category !== 'All') conditions.push(eq(donations.category, category));
    if (dietaryType && dietaryType !== 'All') conditions.push(eq(donations.dietaryType, dietaryType));
    if (minQuantity > 0) conditions.push(gte(donations.remainingQuantity, minQuantity));
    if (deadlineBefore) {
      const parsedDate = new Date(deadlineBefore);
      if (!Number.isNaN(parsedDate.getTime())) {
        conditions.push(lt(donations.collectionDeadline, parsedDate));
      }
    }
    if (search) {
      conditions.push(
        or(
          ilike(donations.foodName, `%${search}%`),
          ilike(donations.description, `%${search}%`),
          ilike(donations.city, `%${search}%`),
          ilike(donations.pinCode, `%${search}%`)
        )!
      );
    }

    const rows = await db
      .select()
      .from(donations)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(donations.createdAt))
      .limit(100);

    if (rows.length === 0) {
      return res.json({ donations: [] });
    }

    const donationIds = rows.map((r) => r.id);
    const donorIds = [...new Set(rows.map((r) => r.donorId))];

    const [allImages, donorUsers, donorProfs] = await Promise.all([
      db.select().from(donationImages).where(inArray(donationImages.donationId, donationIds)),
      db.select({ id: users.id, fullName: users.fullName }).from(users).where(inArray(users.id, donorIds)),
      db
        .select({ userId: donorProfiles.userId, organizationName: donorProfiles.organizationName })
        .from(donorProfiles)
        .where(inArray(donorProfiles.userId, donorIds)),
    ]);

    let viewerClaimIds = new Set<number>();
    let viewerIsApprovedNgo = false;
    if (req.user?.role === 'ngo') {
      const [ngoProf] = await db
        .select()
        .from(ngoProfiles)
        .where(eq(ngoProfiles.userId, req.user.id))
        .limit(1);
      viewerIsApprovedNgo = ngoProf?.verificationStatus === 'approved';
      const myClaims = await db
        .select({ donationId: donationClaims.donationId })
        .from(donationClaims)
        .where(eq(donationClaims.ngoId, req.user.id));
      viewerClaimIds = new Set(myClaims.map((c) => c.donationId));
    }

    const donorNameMap = new Map(donorUsers.map((u) => [u.id, u.fullName]));
    const donorOrgMap = new Map(donorProfs.map((p) => [p.userId, p.organizationName]));

    const result = rows.map((row) => {
      const imgs = allImages.filter((i) => i.donationId === row.id);
      return serializeDonationForViewer(
        row,
        imgs,
        donorNameMap.get(row.donorId) || 'Community Donor',
        donorOrgMap.get(row.donorId) || donorNameMap.get(row.donorId) || 'Verified Donor',
        req.user,
        viewerClaimIds.has(row.id),
        false,
        viewerIsApprovedNgo
      );
    });

    return res.json({ donations: result });
  } catch (error) {
    console.error('Error fetching donations:', error);
    return res.status(500).json({ error: 'Failed to load food donations.' });
  }
});

// Donor's own donations & stats
router.get('/mine', requireAuth, requireRole('donor', 'admin'), async (req: AuthRequest, res) => {
  try {
    await expireOverdueDonations();
    const donorId = req.user!.id;

    const myDonations = await db
      .select()
      .from(donations)
      .where(eq(donations.donorId, donorId))
      .orderBy(desc(donations.createdAt));

    const donationIds = myDonations.map((d) => d.id);
    const images = donationIds.length
      ? await db.select().from(donationImages).where(inArray(donationImages.donationId, donationIds))
      : [];

    const claims = donationIds.length
      ? await db
          .select({
            id: donationClaims.id,
            donationId: donationClaims.donationId,
            ngoId: donationClaims.ngoId,
            claimedQuantity: donationClaims.claimedQuantity,
            status: donationClaims.status,
            notes: donationClaims.notes,
            handoverConfirmedByDonor: donationClaims.handoverConfirmedByDonor,
            createdAt: donationClaims.createdAt,
            ngoName: users.fullName,
            ngoPhone: users.phone,
            ngoOrg: ngoProfiles.organizationName,
          })
          .from(donationClaims)
          .innerJoin(users, eq(donationClaims.ngoId, users.id))
          .leftJoin(ngoProfiles, eq(ngoProfiles.userId, users.id))
          .where(inArray(donationClaims.donationId, donationIds))
      : [];

    const summary = {
      totalDonations: myDonations.length,
      activeDonations: myDonations.filter((d) =>
        ['Available', 'Partially Claimed'].includes(d.status)
      ).length,
      claimedDonations: myDonations.filter((d) =>
        ['Fully Claimed', 'Pickup Scheduled', 'Picked Up', 'Delivered'].includes(d.status)
      ).length,
      completedDonations: myDonations.filter((d) => d.status === 'Completed').length,
      expiredDonations: myDonations.filter((d) => d.status === 'Expired').length,
    };

    const enriched = myDonations.map((d) => ({
      ...d,
      images: images.filter((i) => i.donationId === d.id),
      claims: claims.filter((c) => c.donationId === d.id),
    }));

    return res.json({ summary, donations: enriched });
  } catch (error) {
    console.error('Error fetching donor dashboard:', error);
    return res.status(500).json({ error: 'Failed to load your donations.' });
  }
});

// Single donation details
router.get('/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await expireOverdueDonations();
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'Invalid donation ID.' });
    }

    const [row] = await db.select().from(donations).where(eq(donations.id, id)).limit(1);
    if (!row) {
      return res.status(404).json({ error: 'Donation not found.' });
    }

    const [imgs, [donorUser], [donorProf]] = await Promise.all([
      db.select().from(donationImages).where(eq(donationImages.donationId, id)),
      db.select({ id: users.id, fullName: users.fullName }).from(users).where(eq(users.id, row.donorId)).limit(1),
      db.select().from(donorProfiles).where(eq(donorProfiles.userId, row.donorId)).limit(1),
    ]);

    let viewerHasClaim = false;
    let viewerIsAssignedVolunteer = false;
    let viewerIsApprovedNgo = false;

    if (req.user) {
      if (req.user.role === 'ngo') {
        const [ngoProf] = await db
          .select()
          .from(ngoProfiles)
          .where(eq(ngoProfiles.userId, req.user.id))
          .limit(1);
        viewerIsApprovedNgo = ngoProf?.verificationStatus === 'approved';
        const [claim] = await db
          .select()
          .from(donationClaims)
          .where(and(eq(donationClaims.donationId, id), eq(donationClaims.ngoId, req.user.id)))
          .limit(1);
        viewerHasClaim = Boolean(claim);
      } else if (req.user.role === 'volunteer') {
        const [pickup] = await db
          .select()
          .from(pickups)
          .where(and(eq(pickups.donationId, id), eq(pickups.volunteerId, req.user.id)))
          .limit(1);
        viewerIsAssignedVolunteer = Boolean(pickup);
      }
    }

    return res.json({
      donation: serializeDonationForViewer(
        row,
        imgs,
        donorUser?.fullName || 'Community Donor',
        donorProf?.organizationName || donorUser?.fullName || 'Verified Donor',
        req.user,
        viewerHasClaim,
        viewerIsAssignedVolunteer,
        viewerIsApprovedNgo
      ),
    });
  } catch (error) {
    console.error('Error loading donation detail:', error);
    return res.status(500).json({ error: 'Failed to load donation details.' });
  }
});

// Create new donation
router.post('/', requireAuth, requireRole('donor', 'admin'), async (req: AuthRequest, res) => {
  try {
    const parsed = createDonationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid donation fields.',
      });
    }

    const data = parsed.data;
    const deadlineDate = new Date(data.collectionDeadline);
    if (Number.isNaN(deadlineDate.getTime()) || deadlineDate <= new Date()) {
      return res.status(400).json({
        error: 'Collection deadline must be a valid future date and time.',
      });
    }

    const coords = await geocodeLocation(data.pickupAddress, data.city, data.pinCode);

    const initialHistory = [
      {
        status: 'Available',
        timestamp: new Date().toISOString(),
        actorId: req.user!.id,
        note: 'Donation listed by donor with FSSAI food handling confirmation.',
      },
    ];

    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(donations)
        .values({
          donorId: req.user!.id,
          foodName: data.foodName.trim(),
          category: data.category,
          description: data.description.trim(),
          totalQuantity: data.totalQuantity,
          remainingQuantity: data.totalQuantity,
          quantityUnit: data.quantityUnit,
          prepDate: data.prepDate,
          prepTime: data.prepTime,
          collectionDeadline: deadlineDate,
          storageConditions: data.storageConditions.trim(),
          dietaryType: data.dietaryType,
          allergenInfo: data.allergenInfo.trim(),
          fssaiSafetyAck: data.fssaiSafetyAck,
          pickupAddress: data.pickupAddress.trim(),
          city: data.city.trim(),
          pinCode: data.pinCode.trim(),
          latitude: coords.latitude,
          longitude: coords.longitude,
          contactInfo: data.contactInfo.trim(),
          pickupInstructions: data.pickupInstructions?.trim() || '',
          status: 'Available',
          statusHistory: initialHistory,
        })
        .returning();

      if (data.imageUrl) {
        await tx.insert(donationImages).values({
          donationId: inserted.id,
          imageUrl: data.imageUrl,
          publicId: data.publicId || null,
          isPrimary: true,
        });
      }

      return inserted;
    });

    // Notify verified NGOs in the same city
    const matchingNgos = await db
      .select({ userId: ngoProfiles.userId, email: users.email })
      .from(ngoProfiles)
      .innerJoin(users, eq(ngoProfiles.userId, users.id))
      .where(
        and(
          eq(ngoProfiles.verificationStatus, 'approved'),
          ilike(ngoProfiles.city, `%${data.city.trim()}%`)
        )
      )
      .limit(20);

    for (const ngo of matchingNgos) {
      await createNotification({
        userId: ngo.userId,
        userEmail: ngo.email,
        type: 'new_donation',
        title: `New Surplus Food in ${data.city}`,
        message: `${data.foodName} (${data.totalQuantity} ${data.quantityUnit}) is available until ${deadlineDate.toLocaleString()}.`,
        relatedEntityType: 'donation',
        relatedEntityId: created.id,
      });
    }

    await recordAuditLog({
      actorId: req.user!.id,
      action: 'DONATION_CREATED',
      targetType: 'donation',
      targetId: created.id,
      details: { foodName: created.foodName, city: created.city },
      ipAddress: req.ip,
    });

    return res.status(201).json({ donation: created });
  } catch (error) {
    console.error('Create donation error:', error);
    return res.status(500).json({ error: 'Failed to publish donation.' });
  }
});

// Edit donation
router.put('/:id', requireAuth, requireRole('donor', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(donations).where(eq(donations.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Donation not found.' });

    if (req.user!.role !== 'admin' && existing.donorId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only edit your own donations.' });
    }

    if (['Completed', 'Cancelled', 'Delivered'].includes(existing.status)) {
      return res.status(400).json({ error: 'Cannot edit a completed or cancelled donation.' });
    }

    const {
      foodName,
      category,
      description,
      totalQuantity,
      quantityUnit,
      collectionDeadline,
      storageConditions,
      dietaryType,
      allergenInfo,
      pickupAddress,
      city,
      pinCode,
      contactInfo,
      pickupInstructions,
      imageUrl,
    } = req.body;

    const claimedAlready = existing.totalQuantity - existing.remainingQuantity;
    const nextTotal = totalQuantity !== undefined ? Number(totalQuantity) : existing.totalQuantity;
    if (nextTotal < claimedAlready) {
      return res.status(400).json({
        error: `Total quantity cannot be less than already claimed quantity (${claimedAlready}).`,
      });
    }

    const nextRemaining = Math.max(0, nextTotal - claimedAlready);
    let coords = { latitude: existing.latitude, longitude: existing.longitude };
    if (pickupAddress || city || pinCode) {
      coords = await geocodeLocation(
        pickupAddress || existing.pickupAddress,
        city || existing.city,
        pinCode || existing.pinCode
      );
    }

    const [updated] = await db
      .update(donations)
      .set({
        ...(foodName ? { foodName: String(foodName).trim() } : {}),
        ...(category ? { category: String(category) } : {}),
        ...(description ? { description: String(description).trim() } : {}),
        totalQuantity: nextTotal,
        remainingQuantity: nextRemaining,
        ...(quantityUnit ? { quantityUnit: String(quantityUnit) } : {}),
        ...(collectionDeadline ? { collectionDeadline: new Date(collectionDeadline) } : {}),
        ...(storageConditions ? { storageConditions: String(storageConditions).trim() } : {}),
        ...(dietaryType ? { dietaryType: String(dietaryType) } : {}),
        ...(allergenInfo ? { allergenInfo: String(allergenInfo).trim() } : {}),
        ...(pickupAddress ? { pickupAddress: String(pickupAddress).trim() } : {}),
        ...(city ? { city: String(city).trim() } : {}),
        ...(pinCode ? { pinCode: String(pinCode).trim() } : {}),
        ...(contactInfo ? { contactInfo: String(contactInfo).trim() } : {}),
        ...(pickupInstructions !== undefined
          ? { pickupInstructions: String(pickupInstructions).trim() }
          : {}),
        latitude: coords.latitude,
        longitude: coords.longitude,
        updatedAt: new Date(),
      })
      .where(eq(donations.id, id))
      .returning();

    if (imageUrl) {
      await db.delete(donationImages).where(eq(donationImages.donationId, id));
      await db.insert(donationImages).values({
        donationId: id,
        imageUrl: String(imageUrl),
        isPrimary: true,
      });
    }

    return res.json({ donation: updated });
  } catch (error) {
    console.error('Edit donation error:', error);
    return res.status(500).json({ error: 'Failed to update donation.' });
  }
});

// Delete / Cancel donation
router.delete('/:id', requireAuth, requireRole('donor', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(donations).where(eq(donations.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Donation not found.' });

    if (req.user!.role !== 'admin' && existing.donorId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized to delete this donation.' });
    }

    const activeClaims = await db
      .select()
      .from(donationClaims)
      .where(
        and(
          eq(donationClaims.donationId, id),
          inArray(donationClaims.status, ['collected', 'delivered', 'completed'])
        )
      );

    if (activeClaims.length > 0) {
      return res.status(400).json({
        error: 'Donations with collected or completed claims cannot be deleted.',
      });
    }

    await db.delete(donations).where(eq(donations.id, id));
    await recordAuditLog({
      actorId: req.user!.id,
      action: 'DONATION_DELETED',
      targetType: 'donation',
      targetId: id,
      details: { foodName: existing.foodName },
      ipAddress: req.ip,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Delete donation error:', error);
    return res.status(500).json({ error: 'Failed to delete donation.' });
  }
});

// Donor confirms food handover
router.post('/:id/handover', requireAuth, requireRole('donor', 'admin'), async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const [existing] = await db.select().from(donations).where(eq(donations.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Donation not found.' });

    if (req.user!.role !== 'admin' && existing.donorId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    await db
      .update(donationClaims)
      .set({ handoverConfirmedByDonor: true, updatedAt: new Date() })
      .where(eq(donationClaims.donationId, id));

    const nextStatus = existing.status === 'Pickup Scheduled' || existing.status === 'Fully Claimed'
      ? 'Picked Up'
      : existing.status;

    const history = [
      ...(existing.statusHistory || []),
      {
        status: nextStatus,
        timestamp: new Date().toISOString(),
        actorId: req.user!.id,
        note: 'Donor confirmed food handover.',
      },
    ];

    const [updated] = await db
      .update(donations)
      .set({ status: nextStatus, statusHistory: history, updatedAt: new Date() })
      .where(eq(donations.id, id))
      .returning();

    return res.json({ donation: updated });
  } catch (error) {
    console.error('Handover confirm error:', error);
    return res.status(500).json({ error: 'Failed to confirm handover.' });
  }
});

// Report unsafe food
router.post('/:id/report-unsafe', requireAuth, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const reason = String(req.body?.reason || '').trim();
    if (reason.length < 5) {
      return res.status(400).json({ error: 'Please provide a clear safety report reason.' });
    }

    const [existing] = await db.select().from(donations).where(eq(donations.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: 'Donation not found.' });

    await db.transaction(async (tx) => {
      await tx
        .update(donations)
        .set({
          unsafeFlagged: true,
          unsafeReason: reason,
          status: 'Cancelled',
          statusHistory: [
            ...(existing.statusHistory || []),
            {
              status: 'Cancelled',
              timestamp: new Date().toISOString(),
              actorId: req.user!.id,
              note: `Flagged unsafe: ${reason}`,
            },
          ],
          updatedAt: new Date(),
        })
        .where(eq(donations.id, id));

      await tx.insert(complaints).values({
        reporterId: req.user!.id,
        donationId: id,
        subject: `Unsafe Food Report: ${existing.foodName}`,
        description: reason,
        severity: 'safety',
        status: 'open',
      });
    });

    // Notify admins
    const admins = await db.select().from(users).where(eq(users.role, 'admin'));
    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        userEmail: admin.email,
        type: 'safety_alert',
        title: 'Urgent Unsafe Food Report',
        message: `Donation #${id} (${existing.foodName}) was flagged unsafe: ${reason}`,
        relatedEntityType: 'donation',
        relatedEntityId: id,
      });
    }

    return res.json({ message: 'Safety report submitted and donation suspended for review.' });
  } catch (error) {
    console.error('Report unsafe error:', error);
    return res.status(500).json({ error: 'Failed to submit safety report.' });
  }
});

export default router;
