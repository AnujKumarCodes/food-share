import { Router } from 'express';
import { and, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  deliveries,
  donationClaims,
  donationImages,
  donations,
  ngoProfiles,
  pickups,
  users,
  volunteerProfiles,
} from '../db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { createNotification, recordAuditLog } from '../services/notifications.ts';

const router = Router();

const createClaimSchema = z.object({
  donationId: z.coerce.number().int().positive(),
  claimedQuantity: z.coerce.number().positive(),
  needsVolunteer: z.boolean().optional().default(true),
  notes: z.string().max(500).optional().default(''),
  scheduledTime: z.string().optional(),
});

// Verified NGO claims available food inside a PostgreSQL transaction
router.post('/claims', requireAuth, requireRole('ngo'), async (req: AuthRequest, res) => {
  try {
    const parsed = createClaimSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid claim details.',
      });
    }

    const { donationId, claimedQuantity, needsVolunteer, notes, scheduledTime } = parsed.data;
    const ngoUserId = req.user!.id;

    // 1. Verify NGO is admin-approved
    const [ngoProf] = await db
      .select()
      .from(ngoProfiles)
      .where(eq(ngoProfiles.userId, ngoUserId))
      .limit(1);

    if (!ngoProf || ngoProf.verificationStatus !== 'approved') {
      return res.status(403).json({
        error:
          'Only admin-verified NGOs can claim food donations. Your verification status is currently: ' +
          (ngoProf?.verificationStatus || 'pending') +
          '.',
      });
    }

    const outcome = await db.transaction(async (tx) => {
      // Lock donation row FOR UPDATE to prevent concurrent over-claiming
      const lockedRows = await tx
        .select()
        .from(donations)
        .where(eq(donations.id, donationId))
        .for('update');

      if (lockedRows.length === 0) {
        return { ok: false as const, error: 'Donation not found.', status: 404 as const };
      }

      const donation = lockedRows[0];

      if (donation.unsafeFlagged) {
        return { ok: false as const, error: 'This donation has been flagged for safety review.', status: 400 as const };
      }
      if (new Date(donation.collectionDeadline) <= new Date() || donation.status === 'Expired') {
        await tx
          .update(donations)
          .set({ status: 'Expired', updatedAt: new Date() })
          .where(eq(donations.id, donation.id));
        return { ok: false as const, error: 'This donation has passed its collection deadline and expired.', status: 400 as const };
      }
      if (!['Available', 'Partially Claimed'].includes(donation.status)) {
        return { ok: false as const, error: `Donation is no longer available (status: ${donation.status}).`, status: 400 as const };
      }
      if (claimedQuantity > donation.remainingQuantity) {
        return {
          ok: false as const,
          error: `Requested quantity (${claimedQuantity}) exceeds remaining available quantity (${donation.remainingQuantity} ${donation.quantityUnit}).`,
          status: 400 as const,
        };
      }

      // Prevent duplicate claim by same NGO on same donation
      const existingClaim = await tx
        .select()
        .from(donationClaims)
        .where(
          and(
            eq(donationClaims.donationId, donationId),
            eq(donationClaims.ngoId, ngoUserId)
          )
        )
        .limit(1);

      if (existingClaim.length > 0) {
        return {
          ok: false as const,
          error: 'Your NGO has already placed a claim on this donation.',
          status: 409 as const,
        };
      }

      const nextRemaining = Number((donation.remainingQuantity - claimedQuantity).toFixed(2));
      const nextStatus = nextRemaining <= 0 ? 'Pickup Scheduled' : 'Partially Claimed';
      const nextHistory = [
        ...(donation.statusHistory || []),
        {
          status: nextStatus,
          timestamp: new Date().toISOString(),
          actorId: ngoUserId,
          note: `Claimed ${claimedQuantity} ${donation.quantityUnit} by ${ngoProf.organizationName || req.user!.fullName}.`,
        },
      ];

      await tx
        .update(donations)
        .set({
          remainingQuantity: nextRemaining,
          status: nextStatus,
          statusHistory: nextHistory,
          updatedAt: new Date(),
        })
        .where(eq(donations.id, donationId));

      const [claim] = await tx
        .insert(donationClaims)
        .values({
          donationId,
          ngoId: ngoUserId,
          claimedQuantity,
          status: needsVolunteer ? 'scheduled' : 'pending_pickup',
          notes: notes.trim(),
          needsVolunteer,
        })
        .returning();

      const pickupDeadline = scheduledTime
        ? new Date(scheduledTime)
        : new Date(Math.min(Date.now() + 90 * 60 * 1000, new Date(donation.collectionDeadline).getTime()));

      const [pickup] = await tx
        .insert(pickups)
        .values({
          claimId: claim.id,
          donationId,
          volunteerId: null,
          scheduledTime: pickupDeadline,
          pickupAddress: `${donation.pickupAddress}, ${donation.city} ${donation.pinCode}`,
          destinationAddress:
            ngoProf.address && ngoProf.city
              ? `${ngoProf.address}, ${ngoProf.city} ${ngoProf.pinCode}`
              : `${ngoProf.organizationName || req.user!.fullName}, ${donation.city}`,
          donorContact: donation.contactInfo,
          ngoContact: `${req.user!.fullName} (${req.user!.phone || req.user!.email})`,
          status: needsVolunteer ? 'open' : 'assigned',
        })
        .returning();

      return { ok: true as const, donation, claim, pickup };
    });

    if (!outcome.ok) {
      return res.status(outcome.status).json({ error: outcome.error });
    }

    // Notify Donor
    const [donorUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, outcome.donation.donorId))
      .limit(1);

    if (donorUser) {
      await createNotification({
        userId: donorUser.id,
        userEmail: donorUser.email,
        type: 'claim_request',
        title: 'Food Donation Claimed',
        message: `${ngoProf.organizationName || req.user!.fullName} claimed ${claimedQuantity} ${outcome.donation.quantityUnit} of "${outcome.donation.foodName}".`,
        relatedEntityType: 'donation',
        relatedEntityId: donationId,
      });
    }

    // Notify local volunteers if volunteer pickup is requested
    if (needsVolunteer) {
      const volunteers = await db
        .select({ userId: volunteerProfiles.userId, email: users.email })
        .from(volunteerProfiles)
        .innerJoin(users, eq(volunteerProfiles.userId, users.id))
        .where(eq(volunteerProfiles.availabilityStatus, 'available'))
        .limit(15);

      for (const v of volunteers) {
        await createNotification({
          userId: v.userId,
          userEmail: v.email,
          type: 'pickup_available',
          title: `Pickup Needed in ${outcome.donation.city}`,
          message: `${outcome.donation.foodName} (${claimedQuantity} ${outcome.donation.quantityUnit}) needs volunteer transport.`,
          relatedEntityType: 'pickup',
          relatedEntityId: outcome.pickup.id,
        });
      }
    }

    await recordAuditLog({
      actorId: ngoUserId,
      action: 'DONATION_CLAIMED',
      targetType: 'claim',
      targetId: outcome.claim.id,
      details: { donationId, claimedQuantity, needsVolunteer },
      ipAddress: req.ip,
    });

    return res.status(201).json({
      claim: outcome.claim,
      pickup: outcome.pickup,
    });
  } catch (error) {
    console.error('Claim creation error:', error);
    return res.status(500).json({ error: 'Failed to claim donation.' });
  }
});

// NGO's claimed donations & history
router.get('/claims/mine', requireAuth, requireRole('ngo', 'admin'), async (req: AuthRequest, res) => {
  try {
    const ngoId = req.user!.id;
    const claims = await db
      .select()
      .from(donationClaims)
      .where(eq(donationClaims.ngoId, ngoId))
      .orderBy(desc(donationClaims.createdAt));

    if (claims.length === 0) {
      return res.json({ claims: [] });
    }

    const donationIds = claims.map((c) => c.donationId);
    const claimIds = claims.map((c) => c.id);

    const [donationRows, imageRows, pickupRows] = await Promise.all([
      db.select().from(donations).where(inArray(donations.id, donationIds)),
      db.select().from(donationImages).where(inArray(donationImages.donationId, donationIds)),
      db.select().from(pickups).where(inArray(pickups.claimId, claimIds)),
    ]);

    const pickupIds = pickupRows.map((p) => p.id);
    const deliveryRows = pickupIds.length
      ? await db.select().from(deliveries).where(inArray(deliveries.pickupId, pickupIds))
      : [];

    const enriched = claims.map((c) => {
      const d = donationRows.find((row) => row.id === c.donationId);
      const imgs = imageRows.filter((i) => i.donationId === c.donationId);
      const pickup = pickupRows.find((p) => p.claimId === c.id) || null;
      const delivery = pickup ? deliveryRows.find((del) => del.pickupId === pickup.id) || null : null;
      return {
        ...c,
        donation: d ? { ...d, images: imgs } : null,
        pickup,
        delivery,
      };
    });

    return res.json({ claims: enriched });
  } catch (error) {
    console.error('NGO claims error:', error);
    return res.status(500).json({ error: 'Failed to load claimed donations.' });
  }
});

// NGO confirms final completion
router.post('/claims/:id/complete', requireAuth, requireRole('ngo', 'admin'), async (req: AuthRequest, res) => {
  try {
    const claimId = Number(req.params.id);
    const [claim] = await db
      .select()
      .from(donationClaims)
      .where(eq(donationClaims.id, claimId))
      .limit(1);

    if (!claim) return res.status(404).json({ error: 'Claim not found.' });
    if (req.user!.role !== 'admin' && claim.ngoId !== req.user!.id) {
      return res.status(403).json({ error: 'Not authorized.' });
    }

    const [donation] = await db
      .select()
      .from(donations)
      .where(eq(donations.id, claim.donationId))
      .limit(1);

    await db.transaction(async (tx) => {
      await tx
        .update(donationClaims)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(eq(donationClaims.id, claimId));

      await tx
        .update(pickups)
        .set({ status: 'delivered', updatedAt: new Date() })
        .where(eq(pickups.claimId, claimId));

      if (donation) {
        await tx
          .update(donations)
          .set({
            status: 'Completed',
            statusHistory: [
              ...(donation.statusHistory || []),
              {
                status: 'Completed',
                timestamp: new Date().toISOString(),
                actorId: req.user!.id,
                note: 'NGO confirmed safe receipt and community distribution completion.',
              },
            ],
            updatedAt: new Date(),
          })
          .where(eq(donations.id, donation.id));
      }
    });

    if (donation) {
      const [donor] = await db.select().from(users).where(eq(users.id, donation.donorId)).limit(1);
      if (donor) {
        await createNotification({
          userId: donor.id,
          userEmail: donor.email,
          type: 'donation_completed',
          title: 'Donation Completed!',
          message: `Your donation "${donation.foodName}" has been received and marked completed.`,
          relatedEntityType: 'donation',
          relatedEntityId: donation.id,
        });
      }
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error('Complete claim error:', error);
    return res.status(500).json({ error: 'Failed to mark claim completed.' });
  }
});

// Volunteer: available open pickups
router.get('/pickups/available', requireAuth, requireRole('volunteer', 'admin'), async (_req: AuthRequest, res) => {
  try {
    const openPickups = await db
      .select({
        pickup: pickups,
        foodName: donations.foodName,
        category: donations.category,
        city: donations.city,
        pinCode: donations.pinCode,
        collectionDeadline: donations.collectionDeadline,
        quantityUnit: donations.quantityUnit,
        claimedQuantity: donationClaims.claimedQuantity,
      })
      .from(pickups)
      .innerJoin(donations, eq(pickups.donationId, donations.id))
      .innerJoin(donationClaims, eq(pickups.claimId, donationClaims.id))
      .where(
        and(
          eq(pickups.status, 'open'),
          isNull(pickups.volunteerId),
          gte(donations.collectionDeadline, new Date())
        )
      )
      .orderBy(desc(pickups.createdAt));

    return res.json({
      pickups: openPickups.map((r) => ({
        ...r.pickup,
        foodName: r.foodName,
        category: r.category,
        city: r.city,
        pinCode: r.pinCode,
        collectionDeadline: r.collectionDeadline,
        quantityUnit: r.quantityUnit,
        claimedQuantity: r.claimedQuantity,
      })),
    });
  } catch (error) {
    console.error('Available pickups error:', error);
    return res.status(500).json({ error: 'Failed to load open pickups.' });
  }
});

// Volunteer: my assigned & completed pickups
router.get('/pickups/mine', requireAuth, requireRole('volunteer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const volunteerId = req.user!.id;
    const rows = await db
      .select({
        pickup: pickups,
        foodName: donations.foodName,
        category: donations.category,
        city: donations.city,
        pinCode: donations.pinCode,
        collectionDeadline: donations.collectionDeadline,
        quantityUnit: donations.quantityUnit,
        claimedQuantity: donationClaims.claimedQuantity,
        delivery: deliveries,
      })
      .from(pickups)
      .innerJoin(donations, eq(pickups.donationId, donations.id))
      .innerJoin(donationClaims, eq(pickups.claimId, donationClaims.id))
      .leftJoin(deliveries, eq(deliveries.pickupId, pickups.id))
      .where(eq(pickups.volunteerId, volunteerId))
      .orderBy(desc(pickups.createdAt));

    return res.json({
      pickups: rows.map((r) => ({
        ...r.pickup,
        foodName: r.foodName,
        category: r.category,
        city: r.city,
        pinCode: r.pinCode,
        collectionDeadline: r.collectionDeadline,
        quantityUnit: r.quantityUnit,
        claimedQuantity: r.claimedQuantity,
        delivery: r.delivery || null,
      })),
    });
  } catch (error) {
    console.error('My pickups error:', error);
    return res.status(500).json({ error: 'Failed to load assigned pickups.' });
  }
});

// Volunteer accepts an open pickup atomically
router.post('/pickups/:id/accept', requireAuth, requireRole('volunteer'), async (req: AuthRequest, res) => {
  try {
    const pickupId = Number(req.params.id);
    const volunteerId = req.user!.id;

    const updated = await db
      .update(pickups)
      .set({
        volunteerId,
        status: 'assigned',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(pickups.id, pickupId),
          eq(pickups.status, 'open'),
          isNull(pickups.volunteerId)
        )
      )
      .returning();

    if (updated.length === 0) {
      return res.status(409).json({
        error: 'Pickup is no longer available or already assigned to another volunteer.',
      });
    }

    const pickup = updated[0];
    const [claim] = await db
      .select()
      .from(donationClaims)
      .where(eq(donationClaims.id, pickup.claimId))
      .limit(1);

    if (claim) {
      await createNotification({
        userId: claim.ngoId,
        type: 'volunteer_assigned',
        title: 'Volunteer Assigned to Pickup',
        message: `${req.user!.fullName} accepted your pickup assignment (#${pickup.id}).`,
        relatedEntityType: 'pickup',
        relatedEntityId: pickup.id,
      });
    }

    await recordAuditLog({
      actorId: volunteerId,
      action: 'PICKUP_ACCEPTED',
      targetType: 'pickup',
      targetId: pickup.id,
      ipAddress: req.ip,
    });

    return res.json({ pickup });
  } catch (error) {
    console.error('Accept pickup error:', error);
    return res.status(500).json({ error: 'Failed to accept pickup assignment.' });
  }
});

// Volunteer confirms food collection (authorized volunteer only)
router.post('/pickups/:id/collect', requireAuth, requireRole('volunteer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const pickupId = Number(req.params.id);
    const [pickup] = await db.select().from(pickups).where(eq(pickups.id, pickupId)).limit(1);
    if (!pickup) return res.status(404).json({ error: 'Pickup not found.' });

    if (req.user!.role !== 'admin' && pickup.volunteerId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only update your own assigned pickups.' });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(pickups)
        .set({ status: 'collected', collectedAt: new Date(), updatedAt: new Date() })
        .where(eq(pickups.id, pickupId));

      await tx
        .update(donationClaims)
        .set({ status: 'collected', updatedAt: new Date() })
        .where(eq(donationClaims.id, pickup.claimId));

      const [donation] = await tx
        .select()
        .from(donations)
        .where(eq(donations.id, pickup.donationId))
        .limit(1);

      if (donation) {
        await tx
          .update(donations)
          .set({
            status: 'Picked Up',
            statusHistory: [
              ...(donation.statusHistory || []),
              {
                status: 'Picked Up',
                timestamp: new Date().toISOString(),
                actorId: req.user!.id,
                note: `Collected by volunteer ${req.user!.fullName}.`,
              },
            ],
            updatedAt: new Date(),
          })
          .where(eq(donations.id, donation.id));
      }
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error('Confirm collection error:', error);
    return res.status(500).json({ error: 'Failed to confirm food collection.' });
  }
});

// Volunteer confirms delivery & uploads proof (authorized volunteer only)
router.post('/pickups/:id/deliver', requireAuth, requireRole('volunteer', 'admin'), async (req: AuthRequest, res) => {
  try {
    const pickupId = Number(req.params.id);
    const receiverName = String(req.body?.receiverName || '').trim();
    const deliveryNotes = String(req.body?.deliveryNotes || '').trim();
    const proofImageUrl = String(req.body?.proofImageUrl || '').trim();

    if (receiverName.length < 2) {
      return res.status(400).json({ error: 'Receiver name is required to confirm delivery.' });
    }

    const [pickup] = await db.select().from(pickups).where(eq(pickups.id, pickupId)).limit(1);
    if (!pickup) return res.status(404).json({ error: 'Pickup not found.' });

    if (req.user!.role !== 'admin' && pickup.volunteerId !== req.user!.id) {
      return res.status(403).json({ error: 'You can only update your own assigned pickups.' });
    }

    const [donation] = await db
      .select()
      .from(donations)
      .where(eq(donations.id, pickup.donationId))
      .limit(1);

    const [claim] = await db
      .select()
      .from(donationClaims)
      .where(eq(donationClaims.id, pickup.claimId))
      .limit(1);

    const delivery = await db.transaction(async (tx) => {
      const [insertedDelivery] = await tx
        .insert(deliveries)
        .values({
          pickupId,
          volunteerId: pickup.volunteerId || req.user!.id,
          receiverName,
          deliveryNotes,
          proofImageUrl: proofImageUrl || null,
          confirmedAt: new Date(),
        })
        .returning();

      await tx
        .update(pickups)
        .set({ status: 'delivered', updatedAt: new Date() })
        .where(eq(pickups.id, pickupId));

      await tx
        .update(donationClaims)
        .set({ status: 'delivered', updatedAt: new Date() })
        .where(eq(donationClaims.id, pickup.claimId));

      await tx
        .update(volunteerProfiles)
        .set({
          completedPickupsCount: sql`${volunteerProfiles.completedPickupsCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(volunteerProfiles.userId, pickup.volunteerId || req.user!.id));

      if (donation) {
        await tx
          .update(donations)
          .set({
            status: 'Delivered',
            statusHistory: [
              ...(donation.statusHistory || []),
              {
                status: 'Delivered',
                timestamp: new Date().toISOString(),
                actorId: req.user!.id,
                note: `Delivered to ${receiverName}.`,
              },
            ],
            updatedAt: new Date(),
          })
          .where(eq(donations.id, donation.id));
      }

      return insertedDelivery;
    });

    if (donation) {
      await createNotification({
        userId: donation.donorId,
        type: 'delivery_confirmed',
        title: 'Food Delivered to Community Partner',
        message: `Your donation "${donation.foodName}" was delivered to ${receiverName}.`,
        relatedEntityType: 'donation',
        relatedEntityId: donation.id,
      });
    }
    if (claim) {
      await createNotification({
        userId: claim.ngoId,
        type: 'delivery_confirmed',
        title: 'Delivery Confirmed by Volunteer',
        message: `Delivery for pickup #${pickupId} was confirmed with receiver ${receiverName}.`,
        relatedEntityType: 'claim',
        relatedEntityId: claim.id,
      });
    }

    await recordAuditLog({
      actorId: req.user!.id,
      action: 'DELIVERY_CONFIRMED',
      targetType: 'delivery',
      targetId: delivery.id,
      details: { pickupId, receiverName },
      ipAddress: req.ip,
    });

    return res.status(201).json({ delivery });
  } catch (error) {
    console.error('Delivery confirmation error:', error);
    return res.status(500).json({ error: 'Failed to confirm delivery.' });
  }
});

export default router;
