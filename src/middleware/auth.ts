import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users } from '../db/schema.ts';
import { getOrCreateFirebaseUser } from '../db/users.ts';

const JWT_SECRET = process.env.JWT_SECRET || 'foodshare-dev-secret-change-in-production';

export interface SafeSessionUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  role: string;
  isEmailVerified: boolean;
  isVerified: boolean;
  isSuspended: boolean;
}

export interface AuthRequest extends Request {
  user?: SafeSessionUser;
}

export function signAppToken(user: { id: number; uid: string; email: string; role: string }) {
  return jwt.sign(
    {
      sub: user.id,
      uid: user.uid,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const val = decodeURIComponent(part.slice(idx + 1).trim());
      result[key] = val;
    }
  }
  return result;
}

async function resolveTokenToUser(token: string): Promise<SafeSessionUser | null> {
  // 1. Try local signed JWT first
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: number; uid?: string };
    if (decoded?.sub) {
      const rows = await db.select().from(users).where(eq(users.id, Number(decoded.sub))).limit(1);
      if (rows.length > 0) {
        const u = rows[0];
        return {
          id: u.id,
          uid: u.uid,
          email: u.email,
          fullName: u.fullName,
          phone: u.phone,
          role: u.role,
          isEmailVerified: u.isEmailVerified,
          isVerified: u.isVerified,
          isSuspended: u.isSuspended,
        };
      }
    }
  } catch {
    // Fall through to Firebase ID token verification
  }

  // 2. Try Firebase ID token
  try {
    const decodedFirebase = await adminAuth.verifyIdToken(token);
    const email = decodedFirebase.email || `${decodedFirebase.uid}@firebase.local`;
    const user = await getOrCreateFirebaseUser(
      decodedFirebase.uid,
      email,
      decodedFirebase.name
    );
    return {
      id: user.id,
      uid: user.uid,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isVerified: user.isVerified,
      isSuspended: user.isSuspended,
    };
  } catch {
    return null;
  }
}

function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token && token !== 'null' && token !== 'undefined') return token;
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.foodshare_token) {
    return cookies.foodshare_token;
  }
  return null;
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const token = extractToken(req);
    if (token) {
      const user = await resolveTokenToUser(token);
      if (user && !user.isSuspended) {
        req.user = user;
      }
    }
  } catch {
    // Ignore optional auth failures
  }
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Authentication required. Please sign in.' });
  }

  const user = await resolveTokenToUser(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }

  if (user.isSuspended) {
    return res.status(403).json({
      error: 'Your account has been suspended. Please contact FoodShare support.',
    });
  }

  req.user = user;
  next();
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
    }
    next();
  };
};
