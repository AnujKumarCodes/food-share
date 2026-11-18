import nodemailer from 'nodemailer';
import { db } from '../db/index.ts';
import { auditLogs, notifications } from '../db/schema.ts';

export function isEmailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function dispatchEmail(to: string, subject: string, textBody: string): Promise<boolean> {
  if (!isEmailConfigured() || !to || to.endsWith('@firebase.local')) {
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT || 587) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'FoodShare <notifications@foodshare.org>',
      to,
      subject,
      text: textBody,
    });
    return true;
  } catch (err) {
    console.error('SMTP email dispatch failed:', err);
    return false;
  }
}

export async function createNotification(params: {
  userId: number;
  userEmail?: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: number;
}) {
  try {
    let emailSent = false;
    if (params.userEmail) {
      emailSent = await dispatchEmail(
        params.userEmail,
        `[FoodShare] ${params.title}`,
        `${params.message}\n\n— FoodShare: Save Food. Share Hope.`
      );
    }

    const [created] = await db
      .insert(notifications)
      .values({
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        relatedEntityType: params.relatedEntityType || null,
        relatedEntityId: params.relatedEntityId || null,
        isRead: false,
        emailSent,
      })
      .returning();

    return created;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
}

export async function recordAuditLog(params: {
  actorId: number | null;
  action: string;
  targetType: string;
  targetId?: number | null;
  details?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      actorId: params.actorId,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId ?? null,
      details: params.details ?? {},
      ipAddress: params.ipAddress ?? '',
    });
  } catch (error) {
    console.error('Failed to record audit log:', error);
  }
}
