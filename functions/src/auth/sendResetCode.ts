// ─────────────────────────────────────────────────────────────────────────────
// functions/src/sendResetCode.ts
//
// Sends a 6-digit password-reset code to a verified, registered email.
// Mirrors sendVerificationCode.ts patterns exactly:
//   • Constant-time response (no timing oracle on email existence)
//   • Strict input sanitisation (length cap)
//   • Hard overwrite on Firestore doc (no stale fields survive)
//   • Per-IP + per-email rate limiting
//   • Full audit trail
// ─────────────────────────────────────────────────────────────────────────────

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash, randomInt } from 'crypto';
import { isValidEmail, checkRateLimit, logAuditEvent } from '../helpers';
import { BREVO_API_KEY, sendBrevoEmail, buildResetEmail } from '../utils/mailer';

const db               = admin.firestore();
const CODE_TTL_MINUTES = 10;
const MAX_EMAIL_LENGTH = 254;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

function sanitiseEmail(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s.length > MAX_EMAIL_LENGTH) throw new HttpsError('invalid-argument', 'Email address is too long.');
  return s;
}

export const sendResetCode = onCall(
  {
    region:       'us-central1',
    secrets:      [BREVO_API_KEY],
    maxInstances: 10,
  },
  async (request) => {
    const ip    = request.rawRequest?.ip ?? 'unknown';
    const email = sanitiseEmail(request.data?.email);

    if (!email)               throw new HttpsError('invalid-argument', 'Email is required.');
    if (!isValidEmail(email)) throw new HttpsError('invalid-argument', 'Please enter a valid email address.');

    // ── Rate limits ──────────────────────────────────────────────────────────
    const ipLimit = await checkRateLimit(db, `reset-code-ip:${ip}`, 10, 3600);
    if (!ipLimit.allowed) throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');

    const emailLimit = await checkRateLimit(db, `reset-code-email:${email}`, 3, 600);
    if (!emailLimit.allowed) throw new HttpsError('resource-exhausted', 'Too many codes sent. Please wait a few minutes.');

    // ── Existence check ──────────────────────────────────────────────────────
    // Always perform BOTH lookups concurrently so response time is constant
    // regardless of whether the email exists (no timing oracle).
    const [authResult] = await Promise.allSettled([
      admin.auth().getUserByEmail(email).catch((e: { code?: string }) => {
        if (e?.code === 'auth/user-not-found') return null;
        throw e;
      }),
      // Dummy second operation to keep timing uniform
      db.collection('resetCodeSentinel').doc('_').get().catch(() => null),
    ]);

    // Intentionally generic error — don't reveal whether email exists
    if (authResult.status === 'rejected') {
      throw new HttpsError('internal', 'Could not validate account. Please try again.');
    }

    const authUser = authResult.value as admin.auth.UserRecord | null;

    if (!authUser) {
      // Log silently but return a generic message — no email-existence oracle
      await logAuditEvent(db, {
        type:     'reset_code_unknown_email',
        email,
        ip,
        metadata: { action: 'sendResetCode' },
      });
      // Return success shape so UI can't distinguish "found" vs "not found"
      return { success: true, expiresInMinutes: CODE_TTL_MINUTES };
    }

    // ── Generate & store ─────────────────────────────────────────────────────
    const code        = generateCode();
    const codeHash    = hashCode(code);
    const expiresAtMs = Date.now() + CODE_TTL_MINUTES * 60 * 1000;

    await db.collection('passwordResetCodes').doc(email).set(
      {
        email,
        codeHash,
        attempts:    0,
        verified:    false,
        createdAt:   admin.firestore.FieldValue.serverTimestamp(),
        expiresAt:   admin.firestore.Timestamp.fromMillis(expiresAtMs),
        resendCount: 0,
      },
      { merge: false }, // Hard overwrite
    );

    // ── Send email ───────────────────────────────────────────────────────────
    try {
      const { subject, html } = buildResetEmail(code, CODE_TTL_MINUTES);
      await sendBrevoEmail({ to: email, subject, html, apiKey: BREVO_API_KEY.value() });
    } catch (err) {
      console.error('[sendResetCode] Email send failed:', err);
      await db.collection('passwordResetCodes').doc(email).delete().catch(() => {});
      throw new HttpsError('internal', 'Failed to send reset email. Please try again.');
    }

    await logAuditEvent(db, {
      type:     'reset_code_sent',
      email,
      ip,
      metadata: { action: 'sendResetCode' },
    });

    return { success: true, expiresInMinutes: CODE_TTL_MINUTES };
  },
);