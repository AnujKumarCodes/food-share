import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { donorProfiles, ngoProfiles, users, verifications, volunteerProfiles } from './schema.ts';

export async function getOrCreateFirebaseUser(
  uid: string,
  email: string,
  fullName?: string,
  requestedRole?: 'donor' | 'ngo' | 'volunteer'
) {
  try {
    const existingByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingByEmail.length > 0) {
      const existing = existingByEmail[0];
      if (existing.uid !== uid) {
        const updated = await db
          .update(users)
          .set({ uid, isEmailVerified: true, updatedAt: new Date() })
          .where(eq(users.id, existing.id))
          .returning();
        return updated[0];
      }
      return existing;
    }

    const safeRole =
      requestedRole && ['donor', 'ngo', 'volunteer'].includes(requestedRole)
        ? requestedRole
        : 'donor';

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email,
        fullName: fullName?.trim() || email.split('@')[0],
        role: safeRole,
        isEmailVerified: true,
        isVerified: safeRole === 'volunteer',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: { email, updatedAt: new Date() },
      })
      .returning();

    const user = inserted[0];

    if (safeRole === 'donor') {
      await db
        .insert(donorProfiles)
        .values({ userId: user.id, organizationName: user.fullName })
        .onConflictDoNothing();
    } else if (safeRole === 'ngo') {
      await db
        .insert(ngoProfiles)
        .values({
          userId: user.id,
          organizationName: user.fullName,
          verificationStatus: 'pending',
        })
        .onConflictDoNothing();
      await db.insert(verifications).values({
        userId: user.id,
        accountRole: 'ngo',
        status: 'pending',
      });
    } else if (safeRole === 'volunteer') {
      await db.insert(volunteerProfiles).values({ userId: user.id }).onConflictDoNothing();
    }

    return user;
  } catch (error) {
    console.error('Database error in getOrCreateFirebaseUser:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

export async function getUserWithProfile(userId: number) {
  try {
    const userRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (userRows.length === 0) return null;
    const user = userRows[0];

    const [donor] = await db
      .select()
      .from(donorProfiles)
      .where(eq(donorProfiles.userId, user.id))
      .limit(1);
    const [ngo] = await db
      .select()
      .from(ngoProfiles)
      .where(eq(ngoProfiles.userId, user.id))
      .limit(1);
    const [volunteer] = await db
      .select()
      .from(volunteerProfiles)
      .where(eq(volunteerProfiles.userId, user.id))
      .limit(1);

    const { passwordHash, emailVerifyToken, resetToken, ...safeUser } = user;
    void passwordHash;
    void emailVerifyToken;
    void resetToken;

    return {
      ...safeUser,
      donorProfile: donor || null,
      ngoProfile: ngo || null,
      volunteerProfile: volunteer || null,
    };
  } catch (error) {
    console.error('Database error in getUserWithProfile:', error);
    throw new Error('Failed to retrieve user profile.', { cause: error });
  }
}
