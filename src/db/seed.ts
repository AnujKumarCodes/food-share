import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { db, pool } from './index.ts';
import {
  deliveries,
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
} from './schema.ts';

async function seed() {
  console.log('Seeding FoodShare PostgreSQL database...');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@foodshare.org';
  const adminPassword = process.env.ADMIN_PASSWORD || 'FoodShareAdmin!2026';

  const existingAdmin = await db.select().from(users).where(eq(users.email, adminEmail)).limit(1);
  if (existingAdmin.length === 0) {
    const hash = await bcrypt.hash(adminPassword, 12);
    await db.insert(users).values({
      uid: 'seed_admin_1',
      email: adminEmail,
      passwordHash: hash,
      fullName: 'FoodShare Operations Admin',
      phone: '+91 98200 10001',
      role: 'admin',
      isEmailVerified: true,
      isVerified: true,
    });
  }

  const demoPasswordHash = await bcrypt.hash('Password123!', 12);

  // Donor 1
  const [donor1] = await db
    .insert(users)
    .values({
      uid: 'seed_donor_1',
      email: 'kitchen@greenleafbistro.org',
      passwordHash: demoPasswordHash,
      fullName: 'Meera Kulkarni',
      phone: '+91 98201 44510',
      role: 'donor',
      isEmailVerified: true,
      isVerified: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: 'Meera Kulkarni' },
    })
    .returning();

  await db
    .insert(donorProfiles)
    .values({
      userId: donor1.id,
      organizationName: 'GreenLeaf Bistro & Catering',
      donorType: 'restaurant',
      fssaiNumber: '11524036000481',
      address: '14 Linking Road, Bandra West',
      city: 'Mumbai',
      pinCode: '400050',
      latitude: 19.0607,
      longitude: 72.8362,
      verifiedByAdmin: true,
    })
    .onConflictDoNothing();

  // Donor 2
  const [donor2] = await db
    .insert(users)
    .values({
      uid: 'seed_donor_2',
      email: 'events@horizonhotels.org',
      passwordHash: demoPasswordHash,
      fullName: 'Rohan Deshmukh',
      phone: '+91 98112 77320',
      role: 'donor',
      isEmailVerified: true,
      isVerified: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: 'Rohan Deshmukh' },
    })
    .returning();

  await db
    .insert(donorProfiles)
    .values({
      userId: donor2.id,
      organizationName: 'Horizon Grand Hotel & Banquets',
      donorType: 'hotel',
      fssaiNumber: '11524036000912',
      address: '28 MG Road, Indiranagar',
      city: 'Bengaluru',
      pinCode: '560038',
      latitude: 12.9784,
      longitude: 77.6408,
      verifiedByAdmin: true,
    })
    .onConflictDoNothing();

  // Verified NGO 1
  const [ngo1] = await db
    .insert(users)
    .values({
      uid: 'seed_ngo_1',
      email: 'ops@ashaannapoorna.org',
      passwordHash: demoPasswordHash,
      fullName: 'Kavita Nair',
      phone: '+91 98204 88190',
      role: 'ngo',
      isEmailVerified: true,
      isVerified: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { isVerified: true },
    })
    .returning();

  await db
    .insert(ngoProfiles)
    .values({
      userId: ngo1.id,
      organizationName: 'Asha Annapoorna Community Trust',
      registrationNumber: 'MH/2018/0194821',
      darpanId: 'MH/2019/024112',
      address: '88 Dadar East Community Hall',
      city: 'Mumbai',
      pinCode: '400014',
      latitude: 19.0178,
      longitude: 72.8478,
      dailyCapacityMeals: 450,
      verificationStatus: 'approved',
      verifiedAt: new Date(),
    })
    .onConflictDoNothing();

  // Verified NGO 2
  const [ngo2] = await db
    .insert(users)
    .values({
      uid: 'seed_ngo_2',
      email: 'rescue@sahayogfoundation.org',
      passwordHash: demoPasswordHash,
      fullName: 'Arvind Menon',
      phone: '+91 98450 22310',
      role: 'ngo',
      isEmailVerified: true,
      isVerified: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { isVerified: true },
    })
    .returning();

  await db
    .insert(ngoProfiles)
    .values({
      userId: ngo2.id,
      organizationName: 'Sahayog Shelter & Meal Network',
      registrationNumber: 'KA/2020/0078142',
      darpanId: 'KA/2021/031094',
      address: '12th Main, HAL 2nd Stage',
      city: 'Bengaluru',
      pinCode: '560008',
      latitude: 12.9719,
      longitude: 77.6412,
      dailyCapacityMeals: 300,
      verificationStatus: 'approved',
      verifiedAt: new Date(),
    })
    .onConflictDoNothing();

  // Pending NGO 3 (for admin approval testing)
  const [ngoPending] = await db
    .insert(users)
    .values({
      uid: 'seed_ngo_pending',
      email: 'hello@sevashelf.org',
      passwordHash: demoPasswordHash,
      fullName: 'Priya Sharma',
      phone: '+91 98109 61234',
      role: 'ngo',
      isEmailVerified: true,
      isVerified: false,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: 'Priya Sharma' },
    })
    .returning();

  await db
    .insert(ngoProfiles)
    .values({
      userId: ngoPending.id,
      organizationName: 'SevaShelf Youth Pantry',
      registrationNumber: 'DL/2024/0099120',
      darpanId: 'DL/2024/045120',
      address: '45 Lajpat Nagar Part II',
      city: 'New Delhi',
      pinCode: '110024',
      dailyCapacityMeals: 180,
      verificationStatus: 'pending',
    })
    .onConflictDoNothing();

  const existingVerifs = await db
    .select()
    .from(verifications)
    .where(eq(verifications.userId, ngoPending.id));
  if (existingVerifs.length === 0) {
    await db.insert(verifications).values({
      userId: ngoPending.id,
      accountRole: 'ngo',
      registrationRef: 'DL/2024/0099120',
      status: 'pending',
    });
  }

  // Volunteer 1
  const [vol1] = await db
    .insert(users)
    .values({
      uid: 'seed_vol_1',
      email: 'vikram.volunteer@foodshare.org',
      passwordHash: demoPasswordHash,
      fullName: 'Vikram Joshi',
      phone: '+91 98207 33491',
      role: 'volunteer',
      isEmailVerified: true,
      isVerified: true,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { fullName: 'Vikram Joshi' },
    })
    .returning();

  await db
    .insert(volunteerProfiles)
    .values({
      userId: vol1.id,
      vehicleType: 'van',
      licenseNumber: 'MH02-2021-88912',
      city: 'Mumbai',
      pinCode: '400050',
      availabilityStatus: 'available',
      completedPickupsCount: 1,
    })
    .onConflictDoNothing();

  // Only insert sample donations if donations table is empty
  const existingDonations = await db.select().from(donations).limit(1);
  if (existingDonations.length === 0) {
    const in6Hours = new Date(Date.now() + 6 * 60 * 60 * 1000);
    const in10Hours = new Date(Date.now() + 10 * 60 * 60 * 1000);
    const in14Hours = new Date(Date.now() + 14 * 60 * 60 * 1000);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const todayDate = new Date().toISOString().slice(0, 10);

    const [d1] = await db
      .insert(donations)
      .values({
        donorId: donor1.id,
        foodName: 'Vegetable Pulao & Dal Tadka Meal Trays',
        category: 'Cooked food',
        description:
          'Freshly prepared surplus corporate lunch trays sealed in food-grade insulated containers. Unserved kitchen reserve.',
        totalQuantity: 45,
        remainingQuantity: 45,
        quantityUnit: 'kg',
        prepDate: todayDate,
        prepTime: '11:30',
        collectionDeadline: in6Hours,
        storageConditions: 'Hot-held above 60°C in insulated Cambro boxes',
        dietaryType: 'veg',
        allergenInfo: 'Contains traces of dairy (ghee)',
        fssaiSafetyAck: true,
        pickupAddress: '14 Linking Road, Bandra West',
        city: 'Mumbai',
        pinCode: '400050',
        latitude: 19.0607,
        longitude: 72.8362,
        contactInfo: 'Meera Kulkarni · +91 98201 44510',
        pickupInstructions: 'Use service gate on 16th Road; ask for Sous Chef Aarav.',
        status: 'Available',
        statusHistory: [
          {
            status: 'Available',
            timestamp: new Date().toISOString(),
            actorId: donor1.id,
            note: 'Listed with FSSAI handling confirmation.',
          },
        ],
      })
      .returning();

    await db.insert(donationImages).values({
      donationId: d1.id,
      imageUrl: '/src/assets/images/donation_cooked_meals_1795010298532.jpg',
      isPrimary: true,
    });

    const [d2] = await db
      .insert(donations)
      .values({
        donorId: donor2.id,
        foodName: 'Assorted Farm Tomatoes, Spinach & Crisp Apples',
        category: 'Vegetables',
        description:
          'Unblemished fresh produce crates from morning banquet inventory surplus. Stored in chilled walk-in pantry.',
        totalQuantity: 60,
        remainingQuantity: 60,
        quantityUnit: 'kg',
        prepDate: todayDate,
        prepTime: '08:00',
        collectionDeadline: in14Hours,
        storageConditions: 'Refrigerated at 4°C in ventilated wooden crates',
        dietaryType: 'vegan',
        allergenInfo: 'None declared',
        fssaiSafetyAck: true,
        pickupAddress: '28 MG Road, Indiranagar',
        city: 'Bengaluru',
        pinCode: '560038',
        latitude: 12.9784,
        longitude: 77.6408,
        contactInfo: 'Rohan Deshmukh · +91 98112 77320',
        pickupInstructions: 'Loading bay B behind main reception.',
        status: 'Available',
        statusHistory: [
          {
            status: 'Available',
            timestamp: new Date().toISOString(),
            actorId: donor2.id,
            note: 'Listed fresh produce surplus.',
          },
        ],
      })
      .returning();

    await db.insert(donationImages).values({
      donationId: d2.id,
      imageUrl: '/src/assets/images/donation_fresh_produce_1795010298845.jpg',
      isPrimary: true,
    });

    const [d3] = await db
      .insert(donations)
      .values({
        donorId: donor1.id,
        foodName: 'Artisan Sourdough Loaves & Multigrain Rolls',
        category: 'Bakery products',
        description:
          'Same-day baked loaves and seeded rolls boxed cleanly in kraft paper cartons at close of morning service.',
        totalQuantity: 32,
        remainingQuantity: 32,
        quantityUnit: 'boxes',
        prepDate: todayDate,
        prepTime: '06:30',
        collectionDeadline: in10Hours,
        storageConditions: 'Ambient dry bakery shelf, sealed kraft boxes',
        dietaryType: 'veg',
        allergenInfo: 'Contains wheat gluten and sesame seeds',
        fssaiSafetyAck: true,
        pickupAddress: '14 Linking Road, Bandra West',
        city: 'Mumbai',
        pinCode: '400050',
        latitude: 19.0622,
        longitude: 72.8389,
        contactInfo: 'Meera Kulkarni · +91 98201 44510',
        pickupInstructions: 'Counter pickup inside main entrance.',
        status: 'Available',
        statusHistory: [
          {
            status: 'Available',
            timestamp: new Date().toISOString(),
            actorId: donor1.id,
            note: 'Listed bakery surplus.',
          },
        ],
      })
      .returning();

    await db.insert(donationImages).values({
      donationId: d3.id,
      imageUrl: '/src/assets/images/donation_artisan_bakery_1795010300015.jpg',
      isPrimary: true,
    });

    // Completed donation for real historical impact stats & review
    const [d4] = await db
      .insert(donations)
      .values({
        donorId: donor1.id,
        foodName: 'Mixed Fruit & Balanced Grain Lunch Boxes',
        category: 'Cooked food',
        description: 'Completed lunch rescue distributed to Dadar shelter residents.',
        totalQuantity: 85,
        remainingQuantity: 0,
        quantityUnit: 'kg',
        prepDate: yesterday.toISOString().slice(0, 10),
        prepTime: '11:00',
        collectionDeadline: yesterday,
        storageConditions: 'Insulated thermal containers',
        dietaryType: 'veg',
        allergenInfo: 'None declared',
        fssaiSafetyAck: true,
        pickupAddress: '14 Linking Road, Bandra West',
        city: 'Mumbai',
        pinCode: '400050',
        latitude: 19.0607,
        longitude: 72.8362,
        contactInfo: 'Meera Kulkarni · +91 98201 44510',
        pickupInstructions: 'Completed handover.',
        status: 'Completed',
        statusHistory: [
          {
            status: 'Available',
            timestamp: yesterday.toISOString(),
            actorId: donor1.id,
            note: 'Listed by donor.',
          },
          {
            status: 'Completed',
            timestamp: new Date().toISOString(),
            actorId: ngo1.id,
            note: 'Delivered and distributed safely.',
          },
        ],
      })
      .returning();

    await db.insert(donationImages).values({
      donationId: d4.id,
      imageUrl: '/src/assets/images/donation_cooked_meals_1795010298532.jpg',
      isPrimary: true,
    });

    const [claim4] = await db
      .insert(donationClaims)
      .values({
        donationId: d4.id,
        ngoId: ngo1.id,
        claimedQuantity: 85,
        status: 'completed',
        notes: 'Distributing across Dadar evening community kitchen.',
        needsVolunteer: true,
        handoverConfirmedByDonor: true,
      })
      .returning();

    const [pickup4] = await db
      .insert(pickups)
      .values({
        claimId: claim4.id,
        donationId: d4.id,
        volunteerId: vol1.id,
        scheduledTime: yesterday,
        pickupAddress: '14 Linking Road, Bandra West, Mumbai 400050',
        destinationAddress: '88 Dadar East Community Hall, Mumbai 400014',
        donorContact: 'Meera Kulkarni · +91 98201 44510',
        ngoContact: 'Kavita Nair · +91 98204 88190',
        status: 'delivered',
        collectedAt: yesterday,
      })
      .returning();

    await db.insert(deliveries).values({
      pickupId: pickup4.id,
      volunteerId: vol1.id,
      receiverName: 'Kavita Nair',
      deliveryNotes: 'All trays delivered warm and sealed.',
      confirmedAt: new Date(),
    });

    await db.insert(reviews).values({
      donationId: d4.id,
      reviewerId: ngo1.id,
      targetUserId: donor1.id,
      rating: 5,
      comment:
        'GreenLeaf Bistro packed every meal tray hygienically with clear prep timestamps. Vikram delivered within 35 minutes, serving 210 residents.',
    });

    await db.insert(reviews).values({
      donationId: d4.id,
      reviewerId: donor1.id,
      targetUserId: ngo1.id,
      rating: 5,
      comment:
        'Before FoodShare, our kitchen surplus went to waste after corporate lunches. Now verified NGOs collect within an hour with zero coordination friction.',
    });

    await db.insert(notifications).values({
      userId: ngoPending.id,
      type: 'verification_pending',
      title: 'Verification Under Review',
      message: 'Your NGO registration is queued for admin approval.',
    });
  }

  console.log('FoodShare seed complete.');
  await pool.end();
}

seed().catch(async (err) => {
  console.error('Seed error:', err);
  await pool.end();
  process.exit(1);
});
