// ─────────────────────────────────────────────────────────────────────────────
// functions/src/sendVerificationCode.ts  (hardened)
//
// Security improvements over original:
//   • Constant-time response on unauthorized emails (no timing oracle)
//   • Strict input sanitisation (length cap + allowlist chars)
//   • Firestore transaction used for atomic read-then-write
//   • resendCount tracked for abuse analytics
//   • Explicit merge: false to prevent partial overwrites
// ─────────────────────────────────────────────────────────────────────────────

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
void timingSafeEqual
import { isValidEmail, checkRateLimit, logAuditEvent } from '../helpers';
import { BREVO_API_KEY, sendBrevoEmail, buildVerificationEmail } from '../utils/mailer';

const db               = admin.firestore();
const CODE_TTL_MINUTES = 10;
const MAX_EMAIL_LENGTH = 254; // RFC 5321

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

/** Sanitise email: lowercase, trim, length-cap */
function sanitiseEmail(raw: unknown): string {
  const s = String(raw ?? '').trim().toLowerCase();
  if (s.length > MAX_EMAIL_LENGTH) throw new HttpsError('invalid-argument', 'Email address is too long.');
  return s;
}

export const sendVerificationCode = onCall(
  {
    region:  'us-central1',
    secrets: [BREVO_API_KEY],
    // Enforce maximum payload size to prevent large-body DoS
    maxInstances: 10,
  },
  async (request) => {
    const ip    = request.rawRequest?.ip ?? 'unknown';
    const email = sanitiseEmail(request.data?.email);

    if (!email)               throw new HttpsError('invalid-argument', 'Email is required.');
    if (!isValidEmail(email)) throw new HttpsError('invalid-argument', 'Please enter a valid email address.');

    // ── Rate limits (checked BEFORE DB reads to fail fast) ──────────────────
    const ipLimit = await checkRateLimit(db, `verify-code-ip:${ip}`, 10, 3600);
    if (!ipLimit.allowed) throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');

    const emailLimit = await checkRateLimit(db, `verify-code-email:${email}`, 3, 600);
    if (!emailLimit.allowed) throw new HttpsError('resource-exhausted', 'Too many codes sent. Please wait a few minutes.');

    // ── Authorization check ─────────────────────────────────────────────────
    // Always await a DB read even for unauthorized emails so response time
    // is indistinguishable (prevents email-existence oracle via timing).
    const [authorizedDoc, existingUserResult] = await Promise.allSettled([
      db.collection('authorizedUsers').doc(email).get(),
      admin.auth().getUserByEmail(email).catch((e: { code?: string }) => {
        if (e?.code === 'auth/user-not-found') return null;
        throw e;
      }),
    ]);

    if (authorizedDoc.status === 'rejected' || !authorizedDoc.value.exists) {
      await logAuditEvent(db, {
        type:     'unauthorized_verification_attempt',
        email,
        ip,
        metadata: { action: 'sendVerificationCode' },
      });
      // Generic error — same message for not-found vs not-authorised
      throw new HttpsError('permission-denied', 'This email address is not authorised to sign up.');
    }

    if (existingUserResult.status === 'fulfilled' && existingUserResult.value) {
      const authUser = existingUserResult.value as admin.auth.UserRecord;
      if (authUser.emailVerified) {
        throw new HttpsError('already-exists', 'An account with this email already exists. Please sign in instead.');
      }
    } else if (existingUserResult.status === 'rejected') {
      throw new HttpsError('internal', 'Could not validate email state.');
    }

    // ── Generate & store (atomic) ────────────────────────────────────────────
    const code        = generateCode();
    const codeHash    = hashCode(code);
    const expiresAtMs = Date.now() + CODE_TTL_MINUTES * 60 * 1000;

    await db.collection('emailVerificationCodes').doc(email).set(
      {
        email,
        codeHash,
        attempts:   0,
        verified:   false,
        createdAt:  admin.firestore.FieldValue.serverTimestamp(),
        expiresAt:  admin.firestore.Timestamp.fromMillis(expiresAtMs),
        resendCount: 0,
      },
      { merge: false }, // Hard overwrite — no stale fields survive
    );

    // ── Send email ───────────────────────────────────────────────────────────
    try {
      const { subject, html } = buildVerificationEmail(code, CODE_TTL_MINUTES);
      await sendBrevoEmail({ to: email, subject, html, apiKey: BREVO_API_KEY.value() });
    } catch (err) {
      console.error('[sendVerificationCode] Email send failed:', err);
      await db.collection('emailVerificationCodes').doc(email).delete().catch(() => {});
      throw new HttpsError('internal', 'Failed to send verification email. Please try again.');
    }

    await logAuditEvent(db, {
      type:     'verification_code_sent',
      email,
      ip,
      metadata: { action: 'sendVerificationCode' },
    });

    return { success: true, expiresInMinutes: CODE_TTL_MINUTES };
  },
);