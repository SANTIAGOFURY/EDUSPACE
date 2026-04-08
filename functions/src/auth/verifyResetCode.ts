// ─────────────────────────────────────────────────────────────────────────────
// functions/src/verifyResetCode.ts
//
// Verifies the 6-digit reset code. On success it issues a one-time reset
// token stored in Firestore — changePassword reads and consumes it.
//
// Mirrors verifyVerificationCode.ts patterns:
//   • Timing-safe hash comparison
//   • Firestore transaction for atomic attempt-increment / verification
//   • Attempt cap inside the transaction (no TOCTOU)
//   • Detailed audit trail on every outcome
// ─────────────────────────────────────────────────────────────────────────────

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { isValidEmail, logAuditEvent } from '../helpers';

const db                  = admin.firestore();
const MAX_VERIFY_ATTEMPTS = 5;
const RESET_TOKEN_TTL_MS  = 15 * 60 * 1000; // 15 min to complete password change

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a.padEnd(64, '\0'));
  const bufB = Buffer.from(b.padEnd(64, '\0'));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Generates a 32-byte hex reset token (unguessable, single-use) */
function generateResetToken(): string {
  return randomBytes(32).toString('hex');
}

export const verifyResetCode = onCall(
  { region: 'us-central1', maxInstances: 10 },
  async (request) => {
    const ip    = request.rawRequest?.ip ?? 'unknown';
    const email = String(request.data?.email ?? '').trim().toLowerCase();
    const code  = String(request.data?.code  ?? '').trim();

    // ── Input validation ─────────────────────────────────────────────────────
    if (!email || !isValidEmail(email)) {
      throw new HttpsError('invalid-argument', 'A valid email is required.');
    }
    if (!/^\d{6}$/.test(code)) {
      throw new HttpsError('invalid-argument', 'Reset code must be exactly 6 digits.');
    }

    const ref          = db.collection('passwordResetCodes').doc(email);
    const incomingHash = hashCode(code);

    type VerifyResult =
      | { outcome: 'not_found' }
      | { outcome: 'already_verified'; resetToken: string }
      | { outcome: 'too_many_attempts'; attempts: number }
      | { outcome: 'expired' }
      | { outcome: 'wrong_code'; attempts: number; remaining: number }
      | { outcome: 'success'; resetToken: string };

    const result = await db.runTransaction<VerifyResult>(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) return { outcome: 'not_found' };

      const data = snap.data() as {
        codeHash:    string;
        attempts?:   number;
        verified?:   boolean;
        expiresAt?:  admin.firestore.Timestamp;
        resetToken?: string;
      };

      // Idempotent: if already verified return the existing token so a client
      // retry after a network blip doesn't force the user to re-enter the code.
      if (data.verified && data.resetToken) {
        return { outcome: 'already_verified', resetToken: data.resetToken };
      }

      const attempts = data.attempts ?? 0;

      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        return { outcome: 'too_many_attempts', attempts };
      }

      const expiresAtMs = data.expiresAt?.toMillis?.() ?? 0;
      if (Date.now() > expiresAtMs) return { outcome: 'expired' };

      const match = safeEqual(incomingHash, data.codeHash);

      if (!match) {
        tx.update(ref, { attempts: admin.firestore.FieldValue.increment(1) });
        const newAttempts = attempts + 1;
        const remaining   = MAX_VERIFY_ATTEMPTS - newAttempts;
        return { outcome: 'wrong_code', attempts: newAttempts, remaining };
      }

      // SUCCESS — store reset token (consumed by changePassword)
      const resetToken     = generateResetToken();
      const tokenExpiresAt = admin.firestore.Timestamp.fromMillis(
        Date.now() + RESET_TOKEN_TTL_MS,
      );

      tx.update(ref, {
        verified:         true,
        verifiedAt:       admin.firestore.FieldValue.serverTimestamp(),
        resetToken,
        resetTokenExpiry: tokenExpiresAt,
      });

      return { outcome: 'success', resetToken };
    });

    // ── Handle outcomes ──────────────────────────────────────────────────────
    switch (result.outcome) {
      case 'not_found':
        throw new HttpsError('not-found', 'No reset code found. Please request a new one.');

      case 'already_verified':
        return { success: true, verified: true, resetToken: result.resetToken };

      case 'too_many_attempts':
        await logAuditEvent(db, {
          type:     'reset_code_blocked',
          email,
          ip,
          metadata: { action: 'verifyResetCode', attempts: result.attempts },
        });
        throw new HttpsError('permission-denied', 'Too many incorrect attempts. Please request a new code.');

      case 'expired':
        await logAuditEvent(db, {
          type:     'reset_code_expired',
          email,
          ip,
          metadata: { action: 'verifyResetCode' },
        });
        throw new HttpsError('deadline-exceeded', 'This code has expired. Please request a new one.');

      case 'wrong_code':
        await logAuditEvent(db, {
          type:     'reset_code_failed',
          email,
          ip,
          metadata: { action: 'verifyResetCode', attempts: result.attempts, remaining: result.remaining },
        });
        throw new HttpsError(
          'permission-denied',
          `Invalid reset code. ${result.remaining} attempt${result.remaining === 1 ? '' : 's'} remaining.`,
        );

      case 'success':
        break;
    }

    await logAuditEvent(db, {
      type:     'reset_code_verified',
      email,
      ip,
      metadata: { action: 'verifyResetCode' },
    });

    return { success: true, verified: true, resetToken: (result as { outcome: 'success'; resetToken: string }).resetToken };
  },
);