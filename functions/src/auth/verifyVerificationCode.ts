// ─────────────────────────────────────────────────────────────────────────────
// functions/src/verifyVerificationCode.ts  (hardened)
//
// Security improvements over original:
//   • Timing-safe hash comparison (prevents timing oracle on code guessing)
//   • Firestore transaction for attempt increment + verification (atomic)
//   • Explicit attempt cap checked inside the transaction (no TOCTOU)
//   • Input sanitisation (digits-only, exact length)
//   • Detailed audit trail on every outcome
// ─────────────────────────────────────────────────────────────────────────────

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createHash, timingSafeEqual } from 'crypto';
import { isValidEmail, logAuditEvent } from '../helpers';

const db                  = admin.firestore();
const MAX_VERIFY_ATTEMPTS = 5;

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}

/**
 * Timing-safe string equality.
 * Converts both strings to fixed-length Buffers so comparison time is
 * always proportional to the hash length, not the position of the first
 * differing character.
 */
function safeEqual(a: string, b: string): boolean {
  // Both are hex SHA-256 digests → always 64 chars — but we pad defensively
  const bufA = Buffer.from(a.padEnd(64, '\0'));
  const bufB = Buffer.from(b.padEnd(64, '\0'));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const verifyVerificationCode = onCall(
  { region: 'us-central1', maxInstances: 10 },
  async (request) => {
    const ip    = request.rawRequest?.ip ?? 'unknown';
    const email = String(request.data?.email ?? '').trim().toLowerCase();
    const code  = String(request.data?.code  ?? '').trim();

    // ── Input validation ─────────────────────────────────────────────────────
    if (!email || !isValidEmail(email)) {
      throw new HttpsError('invalid-argument', 'A valid email is required.');
    }
    // Strict: exactly 6 numeric digits — reject anything else immediately
    if (!/^\d{6}$/.test(code)) {
      throw new HttpsError('invalid-argument', 'Verification code must be exactly 6 digits.');
    }

    const ref          = db.collection('emailVerificationCodes').doc(email);
    const incomingHash = hashCode(code);

    // ── Atomic transaction ───────────────────────────────────────────────────
    // Reads the document, validates, increments attempts (or marks verified)
    // all in a single transaction — no TOCTOU window between the read and write.
    type VerifyResult =
      | { outcome: 'already_verified' }
      | { outcome: 'not_found' }
      | { outcome: 'too_many_attempts'; attempts: number }
      | { outcome: 'expired' }
      | { outcome: 'wrong_code'; attempts: number; remaining: number }
      | { outcome: 'success' };

    const result = await db.runTransaction<VerifyResult>(async (tx) => {
      const snap = await tx.get(ref);

      if (!snap.exists) return { outcome: 'not_found' };

      const data = snap.data() as {
        codeHash:    string;
        attempts?:   number;
        verified?:   boolean;
        expiresAt?:  admin.firestore.Timestamp;
        resendCount?: number;
      };

      // Idempotent success — client may retry on network failure
      if (data.verified) return { outcome: 'already_verified' };

      const attempts = data.attempts ?? 0;

      // Check attempt cap BEFORE doing any comparison (prevents timing leak)
      if (attempts >= MAX_VERIFY_ATTEMPTS) {
        return { outcome: 'too_many_attempts', attempts };
      }

      // Expiry check
      const expiresAtMs = data.expiresAt?.toMillis?.() ?? 0;
      if (Date.now() > expiresAtMs) return { outcome: 'expired' };

      // Timing-safe comparison
      const match = safeEqual(incomingHash, data.codeHash);

      if (!match) {
        tx.update(ref, { attempts: admin.firestore.FieldValue.increment(1) });
        const newAttempts = attempts + 1;
        const remaining   = MAX_VERIFY_ATTEMPTS - newAttempts;
        return { outcome: 'wrong_code', attempts: newAttempts, remaining };
      }

      // SUCCESS — mark verified inside the same transaction
      tx.update(ref, {
        verified:   true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return { outcome: 'success' };
    });

    // ── Handle transaction outcomes ──────────────────────────────────────────
    switch (result.outcome) {
      case 'not_found':
        throw new HttpsError('not-found', 'No verification code found. Please request a new one.');

      case 'already_verified':
        // Idempotent: succeed silently so retries work
        return { success: true, verified: true, alreadyVerified: true };

      case 'too_many_attempts':
        await logAuditEvent(db, {
          type:     'verification_code_blocked',
          email,
          ip,
          metadata: { action: 'verifyVerificationCode', attempts: result.attempts },
        });
        throw new HttpsError('permission-denied', 'Too many incorrect attempts. Please request a new code.');

      case 'expired':
        await logAuditEvent(db, {
          type:     'verification_code_expired',
          email,
          ip,
          metadata: { action: 'verifyVerificationCode' },
        });
        throw new HttpsError('deadline-exceeded', 'This code has expired. Please request a new one.');

      case 'wrong_code':
        await logAuditEvent(db, {
          type:     'verification_code_failed',
          email,
          ip,
          metadata: {
            action:    'verifyVerificationCode',
            attempts:  result.attempts,
            remaining: result.remaining,
          },
        });
        throw new HttpsError(
          'permission-denied',
          `Invalid verification code. ${result.remaining} attempt${result.remaining === 1 ? '' : 's'} remaining.`,
        );

      case 'success':
        break; // fall through
    }

    // ── Post-verification: sync Firebase Auth + Firestore users doc ──────────
    // Best-effort: the code IS verified; don't fail the response if this
    // secondary update encounters a transient error.
    try {
      const authUser = await admin.auth().getUserByEmail(email);
      if (!authUser.emailVerified) {
        await admin.auth().updateUser(authUser.uid, { emailVerified: true });
      }

      const lookupSnap = await db.collection('userLookup').doc(authUser.uid).get();
      if (lookupSnap.exists) {
        const { customId } = lookupSnap.data() as { customId: string };
        await db.collection('users').doc(customId).update({
          emailVerified: true,
          updatedAt:     admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err: unknown) {
      const errCode = (err as { code?: string })?.code;
      if (errCode !== 'auth/user-not-found') {
        // Non-fatal — user may not exist yet (verifying before account creation)
        console.error('verifyVerificationCode: post-verify Auth update failed:', err);
      }
    }

    await logAuditEvent(db, {
      type:     'verification_code_verified',
      email,
      ip,
      metadata: { action: 'verifyVerificationCode' },
    });

    return { success: true, verified: true };
  },
);