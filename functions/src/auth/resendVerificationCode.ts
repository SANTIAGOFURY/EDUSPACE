// ─────────────────────────────────────────────────────────────────────────────
// functions/src/resendVerificationCode.ts
//
// Separate endpoint for RESENDING a verification code.
// Stricter than sendVerificationCode:
//   • Requires a prior pending (un-verified) code to exist
//   • Per-email resend cap: 3 resends / 10 min
//   • Per-IP resend cap:    10 resends / hour
//   • Cooldown enforced server-side (60 s between resends per email)
//   • Invalidates the old code before issuing a new one (no overlap)
// ─────────────────────────────────────────────────────────────────────────────

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash, randomInt } from 'crypto';
import { isValidEmail, checkRateLimit, logAuditEvent } from '../helpers';
import { BREVO_API_KEY, sendBrevoEmail, buildVerificationEmail } from '../utils/mailer';

const db               = admin.firestore();
const CODE_TTL_MINUTES = 10;
const RESEND_COOLDOWN_S = 60; // seconds — mirrors the frontend cooldown

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

export const resendVerificationCode = onCall(
  { region: 'us-central1', secrets: [BREVO_API_KEY] },
  async (request) => {
    const ip    = request.rawRequest?.ip ?? 'unknown';
    const email = String(request.data?.email ?? '').trim().toLowerCase();

    // ── Basic validation ────────────────────────────────────────────────────
    if (!email)               throw new HttpsError('invalid-argument', 'Email is required.');
    if (!isValidEmail(email)) throw new HttpsError('invalid-argument', 'Please enter a valid email address.');

    // ── Must be an authorized user ──────────────────────────────────────────
    const authorizedDoc = await db.collection('authorizedUsers').doc(email).get();
    if (!authorizedDoc.exists) {
      await logAuditEvent(db, {
        type: 'unauthorized_resend_attempt',
        email,
        ip,
        metadata: { action: 'resendVerificationCode' },
      });
      throw new HttpsError('permission-denied', 'This email address is not authorised to sign up.');
    }

    // ── Already fully verified? ─────────────────────────────────────────────
    try {
      const existingUser = await admin.auth().getUserByEmail(email);
      if (existingUser.emailVerified) {
        throw new HttpsError(
          'already-exists',
          'An account with this email already exists. Please sign in instead.',
        );
      }
    } catch (err: unknown) {
      if (err instanceof HttpsError) throw err;
      const code = (err as { code?: string })?.code;
      if (code !== 'auth/user-not-found') {
        throw new HttpsError('internal', 'Could not validate email state.');
      }
    }

    // ── Rate limits ─────────────────────────────────────────────────────────
    // IP-level: prevents cross-email abuse (e.g. enumeration via resend)
    const ipLimit = await checkRateLimit(db, `resend-code-ip:${ip}`, 10, 3600);
    if (!ipLimit.allowed) {
      throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');
    }

    // Email-level: max 3 resends per 10-minute window
    const emailLimit = await checkRateLimit(db, `resend-code-email:${email}`, 3, 600);
    if (!emailLimit.allowed) {
      throw new HttpsError('resource-exhausted', 'Too many codes sent to this address. Please wait a few minutes.');
    }

    // ── Server-side cooldown check ──────────────────────────────────────────
    // Prevents rapid-fire resends even if the client timer is bypassed.
    const existingRef  = db.collection('emailVerificationCodes').doc(email);
    const existingSnap = await existingRef.get();

    if (existingSnap.exists) {
      const existingData = existingSnap.data() as {
        createdAt?: admin.firestore.Timestamp;
        verified?:  boolean;
      };

      // Block resend if the code is already verified
      if (existingData.verified) {
        throw new HttpsError(
          'already-exists',
          'This email has already been verified. Please sign in.',
        );
      }

      // Enforce server-side cooldown
      const createdAtMs = existingData.createdAt?.toMillis?.() ?? 0;
      const elapsedSecs = (Date.now() - createdAtMs) / 1000;
      if (elapsedSecs < RESEND_COOLDOWN_S) {
        const waitSecs = Math.ceil(RESEND_COOLDOWN_S - elapsedSecs);
        throw new HttpsError(
          'resource-exhausted',
          `Please wait ${waitSecs} second${waitSecs === 1 ? '' : 's'} before requesting a new code.`,
        );
      }
    }
    // Note: if no existing code exists we still allow the resend —
    // e.g. the user may have cleared their browser storage.

    // ── Invalidate old code & write new one ─────────────────────────────────
    const code        = generateCode();
    const codeHash    = hashCode(code);
    const expiresAtMs = Date.now() + CODE_TTL_MINUTES * 60 * 1000;

    // Atomic set — completely replaces the old document
    await existingRef.set({
      email,
      codeHash,
      attempts:  0,
      verified:  false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(expiresAtMs),
      resendCount: admin.firestore.FieldValue.increment(1), // diagnostic counter
    }, { merge: false }); // merge: false guarantees the old codeHash is gone

    // ── Send email ───────────────────────────────────────────────────────────
    try {
      const { subject, html } = buildVerificationEmail(code, CODE_TTL_MINUTES);
      await sendBrevoEmail({ to: email, subject, html, apiKey: BREVO_API_KEY.value() });
    } catch (err) {
      console.error('[resendVerificationCode] Email send failed:', err);
      // Roll back the new code so the old slot isn't permanently poisoned
      await existingRef.delete().catch(() => {});
      throw new HttpsError('internal', 'Failed to send verification email. Please try again.');
    }

    await logAuditEvent(db, {
      type: 'verification_code_resent',
      email,
      ip,
      metadata: { action: 'resendVerificationCode' },
    });

    return { success: true, expiresInMinutes: CODE_TTL_MINUTES };
  },
);