import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export interface StatusHistoryEntry {
  status: string;
  timestamp: string;
  actorId: number | null;
  note: string;
}

// 1. User
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    uid: text('uid').notNull().unique(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash'),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull().default(''),
    role: text('role').notNull().default('donor'), // 'donor' | 'ngo' | 'volunteer' | 'admin'
    isEmailVerified: boolean('is_email_verified').notNull().default(false),
    emailVerifyToken: text('email_verify_token'),
    resetToken: text('reset_token'),
    resetTokenExpires: timestamp('reset_token_expires'),
    isVerified: boolean('is_verified').notNull().default(false),
    isSuspended: boolean('is_suspended').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('users_role_idx').on(table.role),
    index('users_email_idx').on(table.email),
  ]
);

// 2. DonorProfile
export const donorProfiles = pgTable(
  'donor_profiles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    organizationName: text('organization_name').notNull().default(''),
    donorType: text('donor_type').notNull().default('restaurant'), // restaurant | hotel | cafe | grocery | event | individual
    fssaiNumber: text('fssai_number').default(''),
    address: text('address').notNull().default(''),
    city: text('city').notNull().default(''),
    pinCode: text('pin_code').notNull().default(''),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    verifiedByAdmin: boolean('verified_by_admin').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('donor_profiles_city_idx').on(table.city)]
);

// 3. NGOProfile
export const ngoProfiles = pgTable(
  'ngo_profiles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    organizationName: text('organization_name').notNull().default(''),
    registrationNumber: text('registration_number').notNull().default(''),
    darpanId: text('darpan_id').default(''),
    address: text('address').notNull().default(''),
    city: text('city').notNull().default(''),
    pinCode: text('pin_code').notNull().default(''),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    dailyCapacityMeals: integer('daily_capacity_meals').notNull().default(100),
    verificationStatus: text('verification_status').notNull().default('pending'), // pending | approved | rejected
    rejectionReason: text('rejection_reason'),
    verifiedAt: timestamp('verified_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('ngo_profiles_status_idx').on(table.verificationStatus),
    index('ngo_profiles_city_idx').on(table.city),
  ]
);

// 4. VolunteerProfile
export const volunteerProfiles = pgTable(
  'volunteer_profiles',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    vehicleType: text('vehicle_type').notNull().default('two_wheeler'), // two_wheeler | car | van | cycle
    licenseNumber: text('license_number').default(''),
    city: text('city').notNull().default(''),
    pinCode: text('pin_code').notNull().default(''),
    availabilityStatus: text('availability_status').notNull().default('available'), // available | busy | offline
    completedPickupsCount: integer('completed_pickups_count').notNull().default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('volunteer_profiles_city_idx').on(table.city)]
);

// 5. Donation
export const donations = pgTable(
  'donations',
  {
    id: serial('id').primaryKey(),
    donorId: integer('donor_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    foodName: text('food_name').notNull(),
    category: text('category').notNull(), // Cooked food | Fruits | Vegetables | Bakery products | Packaged food | Dairy products | Other
    description: text('description').notNull(),
    totalQuantity: doublePrecision('total_quantity').notNull(),
    remainingQuantity: doublePrecision('remaining_quantity').notNull(),
    quantityUnit: text('quantity_unit').notNull().default('kg'), // kg | meals | boxes | trays | liters
    prepDate: text('prep_date').notNull(),
    prepTime: text('prep_time').notNull(),
    collectionDeadline: timestamp('collection_deadline').notNull(),
    storageConditions: text('storage_conditions').notNull(),
    dietaryType: text('dietary_type').notNull().default('veg'), // veg | non-veg | vegan
    allergenInfo: text('allergen_info').notNull().default('None declared'),
    fssaiSafetyAck: boolean('fssai_safety_ack').notNull().default(false),
    pickupAddress: text('pickup_address').notNull(),
    city: text('city').notNull(),
    pinCode: text('pin_code').notNull(),
    latitude: doublePrecision('latitude').notNull().default(19.076),
    longitude: doublePrecision('longitude').notNull().default(72.8777),
    contactInfo: text('contact_info').notNull(),
    pickupInstructions: text('pickup_instructions').notNull().default(''),
    status: text('status').notNull().default('Available'), // Available | Partially Claimed | Fully Claimed | Pickup Scheduled | Picked Up | Delivered | Completed | Expired | Cancelled
    statusHistory: jsonb('status_history').$type<StatusHistoryEntry[]>().notNull().default([]),
    unsafeFlagged: boolean('unsafe_flagged').notNull().default(false),
    unsafeReason: text('unsafe_reason'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('donations_status_idx').on(table.status),
    index('donations_city_idx').on(table.city),
    index('donations_pincode_idx').on(table.pinCode),
    index('donations_category_idx').on(table.category),
    index('donations_deadline_idx').on(table.collectionDeadline),
    index('donations_donor_idx').on(table.donorId),
  ]
);

// 6. DonationImage
export const donationImages = pgTable(
  'donation_images',
  {
    id: serial('id').primaryKey(),
    donationId: integer('donation_id')
      .references(() => donations.id, { onDelete: 'cascade' })
      .notNull(),
    imageUrl: text('image_url').notNull(),
    publicId: text('public_id'),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('donation_images_donation_idx').on(table.donationId)]
);

// 7. DonationClaim
export const donationClaims = pgTable(
  'donation_claims',
  {
    id: serial('id').primaryKey(),
    donationId: integer('donation_id')
      .references(() => donations.id, { onDelete: 'cascade' })
      .notNull(),
    ngoId: integer('ngo_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    claimedQuantity: doublePrecision('claimed_quantity').notNull(),
    status: text('status').notNull().default('pending_pickup'), // pending_pickup | scheduled | collected | delivered | completed | cancelled
    notes: text('notes').notNull().default(''),
    needsVolunteer: boolean('needs_volunteer').notNull().default(true),
    handoverConfirmedByDonor: boolean('handover_confirmed_by_donor').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('donation_claims_donation_idx').on(table.donationId),
    index('donation_claims_ngo_idx').on(table.ngoId),
    uniqueIndex('donation_claims_unique_active_idx').on(table.donationId, table.ngoId),
  ]
);

// 8. Pickup
export const pickups = pgTable(
  'pickups',
  {
    id: serial('id').primaryKey(),
    claimId: integer('claim_id')
      .references(() => donationClaims.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    donationId: integer('donation_id')
      .references(() => donations.id, { onDelete: 'cascade' })
      .notNull(),
    volunteerId: integer('volunteer_id').references(() => users.id, { onDelete: 'set null' }),
    scheduledTime: timestamp('scheduled_time').notNull(),
    pickupAddress: text('pickup_address').notNull(),
    destinationAddress: text('destination_address').notNull(),
    donorContact: text('donor_contact').notNull(),
    ngoContact: text('ngo_contact').notNull(),
    status: text('status').notNull().default('open'), // open | assigned | collected | delivered | cancelled
    collectedAt: timestamp('collected_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('pickups_status_idx').on(table.status),
    index('pickups_volunteer_idx').on(table.volunteerId),
  ]
);

// 9. Delivery
export const deliveries = pgTable(
  'deliveries',
  {
    id: serial('id').primaryKey(),
    pickupId: integer('pickup_id')
      .references(() => pickups.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),
    volunteerId: integer('volunteer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    proofImageUrl: text('proof_image_url'),
    receiverName: text('receiver_name').notNull(),
    deliveryNotes: text('delivery_notes').notNull().default(''),
    confirmedAt: timestamp('confirmed_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('deliveries_volunteer_idx').on(table.volunteerId)]
);

// 10. Notification
export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    relatedEntityType: text('related_entity_type'),
    relatedEntityId: integer('related_entity_id'),
    isRead: boolean('is_read').notNull().default(false),
    emailSent: boolean('email_sent').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('notifications_user_idx').on(table.userId),
    index('notifications_read_idx').on(table.isRead),
  ]
);

// 11. Review
export const reviews = pgTable(
  'reviews',
  {
    id: serial('id').primaryKey(),
    donationId: integer('donation_id')
      .references(() => donations.id, { onDelete: 'cascade' })
      .notNull(),
    reviewerId: integer('reviewer_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    targetUserId: integer('target_user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull().default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('reviews_target_idx').on(table.targetUserId)]
);

// 12. Complaint
export const complaints = pgTable(
  'complaints',
  {
    id: serial('id').primaryKey(),
    reporterId: integer('reporter_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    donationId: integer('donation_id').references(() => donations.id, { onDelete: 'set null' }),
    subject: text('subject').notNull(),
    description: text('description').notNull(),
    severity: text('severity').notNull().default('medium'), // low | medium | high | safety
    status: text('status').notNull().default('open'), // open | investigating | resolved | dismissed
    adminResolutionNotes: text('admin_resolution_notes').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [index('complaints_status_idx').on(table.status)]
);

// 13. Verification
export const verifications = pgTable(
  'verifications',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    accountRole: text('account_role').notNull(), // ngo | donor
    documentUrl: text('document_url').default(''),
    registrationRef: text('registration_ref').notNull().default(''),
    status: text('status').notNull().default('pending'), // pending | approved | rejected
    reviewedBy: integer('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewNotes: text('review_notes').default(''),
    reviewedAt: timestamp('reviewed_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('verifications_user_idx').on(table.userId),
    index('verifications_status_idx').on(table.status),
  ]
);

// 14. AuditLog
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    actorId: integer('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    targetType: text('target_type').notNull(),
    targetId: integer('target_id'),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: text('ip_address').default(''),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('audit_logs_actor_idx').on(table.actorId),
    index('audit_logs_action_idx').on(table.action),
  ]
);

// Supporting Tables: Voluntary Contributions (Razorpay) & Contact Messages
export const contributions = pgTable('contributions', {
  id: serial('id').primaryKey(),
  supporterName: text('supporter_name').notNull(),
  supporterEmail: text('supporter_email').notNull(),
  organizationName: text('organization_name').default(''),
  amountInr: integer('amount_inr').notNull(),
  contributionType: text('contribution_type').notNull().default('voluntary'), // voluntary | csr_partnership | logistics_grant
  razorpayOrderId: text('razorpay_order_id'),
  razorpayPaymentId: text('razorpay_payment_id'),
  status: text('status').notNull().default('pledged'), // pledged | order_created | paid
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  topic: text('topic').notNull().default('General Inquiry'),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  donorProfile: one(donorProfiles, { fields: [users.id], references: [donorProfiles.userId] }),
  ngoProfile: one(ngoProfiles, { fields: [users.id], references: [ngoProfiles.userId] }),
  volunteerProfile: one(volunteerProfiles, {
    fields: [users.id],
    references: [volunteerProfiles.userId],
  }),
  donations: many(donations),
  claims: many(donationClaims),
  notifications: many(notifications),
}));

export const donationsRelations = relations(donations, ({ one, many }) => ({
  donor: one(users, { fields: [donations.donorId], references: [users.id] }),
  images: many(donationImages),
  claims: many(donationClaims),
  pickups: many(pickups),
}));

export const donationImagesRelations = relations(donationImages, ({ one }) => ({
  donation: one(donations, { fields: [donationImages.donationId], references: [donations.id] }),
}));

export const donationClaimsRelations = relations(donationClaims, ({ one }) => ({
  donation: one(donations, { fields: [donationClaims.donationId], references: [donations.id] }),
  ngo: one(users, { fields: [donationClaims.ngoId], references: [users.id] }),
  pickup: one(pickups, { fields: [donationClaims.id], references: [pickups.claimId] }),
}));

export const pickupsRelations = relations(pickups, ({ one }) => ({
  claim: one(donationClaims, { fields: [pickups.claimId], references: [donationClaims.id] }),
  donation: one(donations, { fields: [pickups.donationId], references: [donations.id] }),
  volunteer: one(users, { fields: [pickups.volunteerId], references: [users.id] }),
  delivery: one(deliveries, { fields: [pickups.id], references: [deliveries.pickupId] }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  pickup: one(pickups, { fields: [deliveries.pickupId], references: [pickups.id] }),
  volunteer: one(users, { fields: [deliveries.volunteerId], references: [users.id] }),
}));
