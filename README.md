# FoodShare — Save Food. Share Hope.

FoodShare is a full-stack food donation and surplus redistribution platform connecting restaurants, hotels, cafes, grocery stores, event organizers, and individual donors with admin-verified NGOs and distribution volunteers.

## Architecture & Folder Structure

```
.
├── server.ts                         # Express REST API server + Vite SSR/SPA host (Port 3000)
├── firebase-applet-config.json       # Firebase Auth web configuration
├── package.json                      # Dependencies & scripts (dev, build, start, seed, lint)
├── .env.example                      # Environment variable template
├── uploads/                          # Local upload fallback directory when Cloudinary is unconfigured
└── src/
    ├── db/
    │   ├── index.ts                  # PostgreSQL pg.Pool (Object Method) + Drizzle ORM instance
    │   ├── schema.ts                 # 16 relational PostgreSQL tables + indexes + foreign keys
    │   ├── drizzle.config.ts         # Drizzle Kit schema management config
    │   ├── users.ts                  # Transactional user upsert & profile helpers
    │   └── seed.ts                   # Development seed script (Admin, Donors, NGOs, Volunteers, Donations)
    ├── lib/
    │   ├── firebase.ts               # Client Firebase Auth (Google Sign-In)
    │   ├── firebase-admin.ts         # Server Firebase Admin ID token verification
    │   └── api.ts                    # Typed fetch client with in-memory token + credentials
    ├── middleware/
    │   └── auth.ts                   # Dual JWT + Firebase Auth & role-based authorization middleware
    ├── services/
    │   ├── cloudinary.ts             # Signed Cloudinary upload with safe local storage fallback
    │   ├── geocoding.ts              # OpenStreetMap Nominatim geocoding + deterministic fallback
    │   └── notifications.ts          # PostgreSQL in-app alerts, SMTP email service, and AuditLog writer
    ├── routes/
    │   ├── auth.ts                   # Register, Login, Logout, Google sync, Forgot/Reset password, Profile
    │   ├── donations.ts              # Donation CRUD, filtering, privacy gating, handover, unsafe reporting
    │   ├── claimsAndPickups.ts       # Transactional NGO claiming (FOR UPDATE), volunteer pickup & delivery
    │   ├── adminAndCommunity.ts      # Public stats, Contact, Razorpay contributions, Notifications, Admin Ops & CSV
    │   └── upload.ts                 # Multer secure image upload endpoint
    ├── context/
    │   └── AuthContext.tsx           # Client authentication & notification state
    ├── components/
    │   ├── Navbar.tsx                # Responsive 3-zone header + notification popover
    │   ├── Footer.tsx                # Footer + FSSAI disclaimer
    │   ├── DonationMap.tsx           # OpenStreetMap + Leaflet interactive map with directions
    │   └── FoodImage.tsx             # Resilient image wrapper with fallback container
    └── pages/
        ├── HomePage.tsx              # Hero, DB-driven stats, How It Works, Featured Donations, Mission, FAQ, Contact
        ├── AuthPages.tsx             # Login, Register, Forgot Password, Reset Password
        ├── FindFoodPage.tsx          # Search, filters, OpenStreetMap view, claim modal, safety report
        ├── DonorDashboard.tsx        # Donor KPIs, 17-field donation form, image upload, handover confirmation
        ├── NgoDashboard.tsx          # Verification banner, claimed donations, pickup tracking, reviews
        ├── VolunteerDashboard.tsx    # Open pickups, accept assignment, collect & delivery proof upload
        ├── AdminDashboard.tsx        # Verifications, user suspension, complaints, audit logs, CSV export
        └── ProfileAndSupportPages.tsx# Profile management, email verification, optional Razorpay CSR support
```

## Database Schema (Cloud SQL PostgreSQL + Drizzle ORM)

Core relational models defined in `src/db/schema.ts`:
- `users`, `donor_profiles`, `ngo_profiles`, `volunteer_profiles`
- `donations`, `donation_images`, `donation_claims`, `pickups`, `deliveries`
- `notifications`, `reviews`, `complaints`, `verifications`, `audit_logs`
- `contributions`, `contact_messages`

> Note: Cloud SQL in AI Studio uses Drizzle ORM with PostgreSQL (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`, `SQL_ADMIN_USER`, `SQL_ADMIN_PASSWORD`).

## Installation & Local Development

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure environment variables based on `.env.example`.
3. Push schema & run seed data:
   ```bash
   npx drizzle-kit push --config=src/db/drizzle.config.ts
   npm run seed
   ```
4. Start development server on port 3000:
   ```bash
   npm run dev
   ```

## Seeded Development Accounts

- **Admin**: `admin@foodshare.org` / `FoodShareAdmin!2026`
- **Donor**: `kitchen@greenleafbistro.org` / `Password123!`
- **Verified NGO**: `ops@ashaannapoorna.org` / `Password123!`
- **Pending NGO**: `hello@sevashelf.org` / `Password123!`
- **Volunteer**: `vikram.volunteer@foodshare.org` / `Password123!`

## REST API Reference

- `GET /api/health` — Service & optional integration configuration status
- `GET /api/public/stats` — Database-driven impact stats, featured donations, NGO partners, testimonials
- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `POST /api/auth/firebase-sync` · `PUT /api/auth/profile` · `POST /api/auth/verify-email`
- `POST /api/auth/forgot-password` · `POST /api/auth/reset-password`
- `GET /api/donations` · `GET /api/donations/mine` · `GET /api/donations/:id`
- `POST /api/donations` · `PUT /api/donations/:id` · `DELETE /api/donations/:id`
- `POST /api/donations/:id/handover` · `POST /api/donations/:id/report-unsafe`
- `POST /api/claims` (Transactional NGO claim) · `GET /api/claims/mine` · `POST /api/claims/:id/complete`
- `GET /api/pickups/available` · `GET /api/pickups/mine` · `POST /api/pickups/:id/accept`
- `POST /api/pickups/:id/collect` · `POST /api/pickups/:id/deliver`
- `POST /api/upload` · `GET /api/notifications` · `POST /api/contact` · `POST /api/contributions`
- `GET /api/admin/overview` · `POST /api/admin/verifications/:userId/decision`
- `PATCH /api/admin/users/:id/suspend` · `PATCH /api/admin/complaints/:id` · `GET /api/admin/export/donations.csv`

## Deployment Guide

- **Frontend / Full-stack Build**: `npm run build` compiles the React + Vite frontend into `dist/`.
- **Production Server (Render / Railway / Cloud Run)**: Set `NODE_ENV=production`, configure PostgreSQL (`SQL_*`), `JWT_SECRET`, and optional `CLOUDINARY_*`, `SMTP_*`, `RAZORPAY_*` environment variables, then start with `npm start` (`node server.ts`).
- **Static Frontend Split (Vercel)**: Deploy `dist/` to Vercel with `/api/*` rewritten to your Render/Railway backend URL (`APP_URL` set in CORS).
