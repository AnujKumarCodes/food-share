import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.ts';
import {
  donorProfiles,
  ngoProfiles,
  users,
  verifications,
  volunteerProfiles,
} from '../db/schema.ts';
import { getOrCreateFirebaseUser, getUserWithProfile } from '../db/users.ts';
import { adminAuth } from '../lib/firebase-admin.ts';
import { AuthRequest, requireAuth, signAppToken } from '../middleware/auth.ts';
import { createNotification, recordAuditLog } from '../services/notifications.ts';

const router = Router();

const registerSchema = z
  .object({
    fullName: z.string().min(2, 'Full name is required').max(120),
    email: z.string().email('Valid email is required').toLowerCase(),
    phone: z.string().min(7, 'Valid phone number is required').max(20),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(8),
    role: z.enum(['donor', 'ngo', 'volunteer']),
    organizationName: z.string().optional(),
    donorType: z.string().optional(),
    registrationNumber: z.string().optional(),
    darpanId: z.string().optional(),
    dailyCapacityMeals: z.coerce.number().int().positive().optional(),
    vehicleType: z.string().optional(),
    city: z.string().optional(),
    pinCode: z.string().optional(),
    address: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

function setAuthCookie(res: Response, token: string) {
  res.cookie('foodshare_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: parsed.error.issues[0]?.message || 'Invalid registration input',
      });
    }

    const data = parsed.data;
    const existing = await db.select().from(users).where(eq(users.email, data.email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const emailVerifyToken = crypto.randomBytes(24).toString('hex');
    const uid = `local_${crypto.randomUUID()}`;

    const createdUser = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          uid,
          email: data.email,
          passwordHash,
          fullName: data.fullName.trim(),
          phone: data.phone.trim(),
          role: data.role,
          isEmailVerified: false,
          emailVerifyToken,
          isVerified: data.role === 'volunteer',
        })
        .returning();

      if (data.role === 'donor') {
        await tx.insert(donorProfiles).values({
          userId: user.id,
          organizationName: data.organizationName?.trim() || data.fullName.trim(),
          donorType: data.donorType || 'restaurant',
          address: data.address?.trim() || '',
          city: data.city?.trim() || '',
          pinCode: data.pinCode?.trim() || '',
        });
      } else if (data.role === 'ngo') {
        await tx.insert(ngoProfiles).values({
          userId: user.id,
          organizationName: data.organizationName?.trim() || data.fullName.trim(),
          registrationNumber: data.registrationNumber?.trim() || '',
          darpanId: data.darpanId?.trim() || '',
          address: data.address?.trim() || '',
          city: data.city?.trim() || '',
          pinCode: data.pinCode?.trim() || '',
          dailyCapacityMeals: data.dailyCapacityMeals || 100,
          verificationStatus: 'pending',
        });

        await tx.insert(verifications).values({
          userId: user.id,
          accountRole: 'ngo',
          registrationRef: data.registrationNumber?.trim() || 'Pending reference',
          status: 'pending',
        });
      } else if (data.role === 'volunteer') {
        await tx.insert(volunteerProfiles).values({
          userId: user.id,
          vehicleType: data.vehicleType || 'two_wheeler',
          city: data.city?.trim() || '',
          pinCode: data.pinCode?.trim() || '',
          availabilityStatus: 'available',
        });
      }

      return user;
    });

    await createNotification({
      userId: createdUser.id,
      userEmail: createdUser.email,
      type: 'welcome',
      title: 'Welcome to FoodShare',
      message:
        data.role === 'ngo'
          ? 'Your NGO account is registered and awaiting admin verification before claiming food. Please also verify your email.'
          : 'Your FoodShare account is ready. Please verify your email address from your profile.',
    });

    await recordAuditLog({
      actorId: createdUser.id,
      action: 'USER_REGISTERED',
      targetType: 'user',
      targetId: createdUser.id,
      details: { role: createdUser.role, email: createdUser.email },
      ipAddress: req.ip,
    });

    const token = signAppToken({
      id: createdUser.id,
      uid: createdUser.uid,
      email: createdUser.email,
      role: createdUser.role,
    });
    setAuthCookie(res, token);

    const profileUser = await getUserWithProfile(createdUser.id);
    return res.status(201).json({
      token,
      user: profileUser,
      emailVerificationTokenPreview:
        process.env.SMTP_HOST ? undefined : emailVerifyToken,
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Valid email and password are required.' });
    }

    const { email, password } = parsed.data;
    const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = rows[0];
    if (!user.passwordHash) {
      return res.status(401).json({
        error: 'This account uses Google Sign-In. Please continue with Google.',
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.isSuspended) {
      return res.status(403).json({
        error: 'This account has been suspended by an administrator.',
      });
    }

    const token = signAppToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
      role: user.role,
    });
    setAuthCookie(res, token);

    const profileUser = await getUserWithProfile(user.id);
    return res.json({ token, user: profileUser });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

router.post('/firebase-sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) {
      return res.status(401).json({ error: 'Missing Firebase ID token.' });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email;
    if (!email) {
      return res.status(400).json({ error: 'Google account email is required.' });
    }

    const requestedRole = req.body?.role as 'donor' | 'ngo' | 'volunteer' | undefined;
    const user = await getOrCreateFirebaseUser(decoded.uid, email, decoded.name, requestedRole);
    if (user.isSuspended) {
      return res.status(403).json({ error: 'Account is suspended.' });
    }

    const token = signAppToken({
      id: user.id,
      uid: user.uid,
      email: user.email,
      role: user.role,
    });
    setAuthCookie(res, token);

    const profileUser = await getUserWithProfile(user.id);
    return res.json({ token, user: profileUser });
  } catch (error) {
    console.error('Firebase sync error:', error);
    return res.status(401).json({ error: 'Invalid Google sign-in token.' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('foodshare_token', { path: '/' });
  return res.json({ ok: true });
});

router.get('/me', async (req: AuthRequest, res) => {
  try {
    // Attempt cookie/header resolution without throwing 401 so frontend can hydrate cleanly
    const cookies = req.headers.cookie || '';
    const hasAuth = Boolean(req.headers.authorization || cookies.includes('foodshare_token'));
    if (!hasAuth) {
      return res.json({ user: null });
    }

    // Reuse requireAuth logic indirectly via middleware or manual check
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!token) {
      const match = cookies.match(/(?:^|;\s*)foodshare_token=([^;]+)/);
      if (match) token = decodeURIComponent(match[1]);
    }
    if (!token) return res.json({ user: null });

    // Delegate to verify logic
    const jwtModule = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET || 'foodshare-dev-secret-change-in-production';
    let userId: number | null = null;
    try {
      const decoded = jwtModule.default.verify(token, JWT_SECRET) as { sub?: number };
      if (decoded?.sub) userId = Number(decoded.sub);
    } catch {
      try {
        const fb = await adminAuth.verifyIdToken(token);
        if (fb.email) {
          const synced = await getOrCreateFirebaseUser(fb.uid, fb.email, fb.name);
          userId = synced.id;
        }
      } catch {
        return res.json({ user: null });
      }
    }

    if (!userId) return res.json({ user: null });
    const profileUser = await getUserWithProfile(userId);
    if (!profileUser || profileUser.isSuspended) return res.json({ user: null });
    return res.json({ user: profileUser });
  } catch {
    return res.json({ user: null });
  }
});

router.put('/profile', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const {
      fullName,
      phone,
      organizationName,
      donorType,
      fssaiNumber,
      registrationNumber,
      darpanId,
      dailyCapacityMeals,
      vehicleType,
      licenseNumber,
      availabilityStatus,
      address,
      city,
      pinCode,
    } = req.body;

    if (fullName || phone) {
      await db
        .update(users)
        .set({
          ...(fullName ? { fullName: String(fullName).trim() } : {}),
          ...(phone !== undefined ? { phone: String(phone).trim() } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    }

    if (req.user!.role === 'donor') {
      await db
        .insert(donorProfiles)
        .values({
          userId,
          organizationName: organizationName || req.user!.fullName,
          donorType: donorType || 'restaurant',
          fssaiNumber: fssaiNumber || '',
          address: address || '',
          city: city || '',
          pinCode: pinCode || '',
        })
        .onConflictDoUpdate({
          target: donorProfiles.userId,
          set: {
            ...(organizationName !== undefined ? { organizationName } : {}),
            ...(donorType !== undefined ? { donorType } : {}),
            ...(fssaiNumber !== undefined ? { fssaiNumber } : {}),
            ...(address !== undefined ? { address } : {}),
            ...(city !== undefined ? { city } : {}),
            ...(pinCode !== undefined ? { pinCode } : {}),
            updatedAt: new Date(),
          },
        });
    } else if (req.user!.role === 'ngo') {
      await db
        .insert(ngoProfiles)
        .values({
          userId,
          organizationName: organizationName || req.user!.fullName,
          registrationNumber: registrationNumber || '',
          darpanId: darpanId || '',
          address: address || '',
          city: city || '',
          pinCode: pinCode || '',
          dailyCapacityMeals: Number(dailyCapacityMeals) || 100,
        })
        .onConflictDoUpdate({
          target: ngoProfiles.userId,
          set: {
            ...(organizationName !== undefined ? { organizationName } : {}),
            ...(registrationNumber !== undefined ? { registrationNumber } : {}),
            ...(darpanId !== undefined ? { darpanId } : {}),
            ...(address !== undefined ? { address } : {}),
            ...(city !== undefined ? { city } : {}),
            ...(pinCode !== undefined ? { pinCode } : {}),
            ...(dailyCapacityMeals !== undefined
              ? { dailyCapacityMeals: Number(dailyCapacityMeals) }
              : {}),
            updatedAt: new Date(),
          },
        });
    } else if (req.user!.role === 'volunteer') {
      await db
        .insert(volunteerProfiles)
        .values({
          userId,
          vehicleType: vehicleType || 'two_wheeler',
          licenseNumber: licenseNumber || '',
          city: city || '',
          pinCode: pinCode || '',
          availabilityStatus: availabilityStatus || 'available',
        })
        .onConflictDoUpdate({
          target: volunteerProfiles.userId,
          set: {
            ...(vehicleType !== undefined ? { vehicleType } : {}),
            ...(licenseNumber !== undefined ? { licenseNumber } : {}),
            ...(city !== undefined ? { city } : {}),
            ...(pinCode !== undefined ? { pinCode } : {}),
            ...(availabilityStatus !== undefined ? { availabilityStatus } : {}),
            updatedAt: new Date(),
          },
        });
    }

    const updated = await getUserWithProfile(userId);
    return res.json({ user: updated });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required.' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.emailVerifyToken, token))
      .limit(1);
    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    await db
      .update(users)
      .set({ isEmailVerified: true, emailVerifyToken: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return res.json({ message: 'Email address verified successfully.' });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ error: 'Failed to verify email.' });
  }
});

router.post('/request-email-verification', requireAuth, async (req: AuthRequest, res) => {
  try {
    const token = crypto.randomBytes(24).toString('hex');
    await db
      .update(users)
      .set({ emailVerifyToken: token, updatedAt: new Date() })
      .where(eq(users.id, req.user!.id));

    await createNotification({
      userId: req.user!.id,
      userEmail: req.user!.email,
      type: 'email_verification',
      title: 'Email Verification Requested',
      message: `Use verification code ${token} to confirm your email address.`,
    });

    return res.json({
      message: 'Verification code generated and sent.',
      verificationTokenPreview: process.env.SMTP_HOST ? undefined : token,
    });
  } catch (error) {
    console.error('Request verification error:', error);
    return res.status(500).json({ error: 'Failed to generate verification code.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return res.json({
        message: 'If an account exists for this email, password reset instructions have been issued.',
      });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000);

    await db
      .update(users)
      .set({ resetToken, resetTokenExpires, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    await createNotification({
      userId: user.id,
      userEmail: user.email,
      type: 'password_reset',
      title: 'Password Reset Token',
      message: `Your FoodShare password reset token is: ${resetToken}. It expires in 1 hour.`,
    });

    return res.json({
      message: 'If an account exists for this email, password reset instructions have been issued.',
      resetTokenPreview: process.env.SMTP_HOST ? undefined : resetToken,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ error: 'Failed to process password reset.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const token = String(req.body?.token || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!token || newPassword.length < 8) {
      return res.status(400).json({
        error: 'Valid reset token and new password (8+ chars) are required.',
      });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.resetToken, token))
      .limit(1);

    if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
      return res.status(400).json({ error: 'Reset token is invalid or expired.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db
      .update(users)
      .set({
        passwordHash,
        resetToken: null,
        resetTokenExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return res.json({ message: 'Password updated successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Failed to reset password.' });
  }
});

export default router;
