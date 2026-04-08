// ─────────────────────────────────────────────────────────────────────────────
// functions/src/changePassword.ts
//
// Consumes the one-time reset token issued by verifyResetCode and updates
// the user's Firebase Auth password.
//
// Security properties:
//   • Token is single-use (deleted from Firestore on first use)
//   • Token has a 15-min TTL (enforced server-side)
//   • Password strength validated server-side (min 8 chars)
//   • Per-IP rate limiting to prevent token-brute-force
//   • Full audit trail
// ─────────────────────────────────────────────────────────────────────────────

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { timingSafeEqual } from 'crypto';
import { isValidEmail, checkRateLimit, logAuditEvent } from '../helpers';

const db = admin.firestore();

function safeTokenEqual(a: string, b: string): boolean {
  // Tokens are 64-char hex strings — same length guaranteed, but pad defensively
  const bufA = Buffer.from(a.padEnd(64, '\0'));
  const bufB = Buffer.from(b.padEnd(64, '\0'));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export const changePassword = onCall(
  { region: 'us-central1', maxInstances: 10 },
  async (request) => {
    const ip         = request.rawRequest?.ip ?? 'unknown';
    const email      = String(request.data?.email      ?? '').trim().toLowerCase();
    const resetToken = String(request.data?.resetToken ?? '').trim();
    const newPassword = String(request.data?.newPassword ?? '');

    // ── Input validation ─────────────────────────────────────────────────────
    if (!email || !isValidEmail(email)) {
      throw new HttpsError('invalid-argument', 'A valid email is required.');
    }
    if (!resetToken || resetToken.length !== 64) {
      throw new HttpsError('invalid-argument', 'Invalid reset token.');
    }
    if (!newPassword || newPassword.length < 8) {
      throw new HttpsError('invalid-argument', 'Password must be at least 8 characters.');
    }
    if (newPassword.length > 128) {
      throw new HttpsError('invalid-argument', 'Password is too long.');
    }

    // ── Rate limit ───────────────────────────────────────────────────────────
    const ipLimit = await checkRateLimit(db, `change-password-ip:${ip}`, 10, 3600);
    if (!ipLimit.allowed) throw new HttpsError('resource-exhausted', 'Too many attempts. Please try again later.');

    // ── Load & validate reset token ──────────────────────────────────────────
    const resetDocRef  = db.collection('passwordResetCodes').doc(email);
    const resetDocSnap = await resetDocRef.get();

    if (!resetDocSnap.exists) {
      throw new HttpsError('not-found', 'No password reset session found. Please start over.');
    }

    const resetData = resetDocSnap.data() as {
      verified?:         boolean;
      resetToken?:       string;
      resetTokenExpiry?: admin.firestore.Timestamp;
    };

    if (!resetData.verified || !resetData.resetToken) {
      throw new HttpsError('failed-precondition', 'Email not yet verified. Please complete the verification step.');
    }

    // Token expiry
    const tokenExpiryMs = resetData.resetTokenExpiry?.toMillis?.() ?? 0;
    if (Date.now() > tokenExpiryMs) {
      throw new HttpsError('deadline-exceeded', 'Your reset session has expired. Please start over.');
    }

    // Timing-safe token comparison
    if (!safeTokenEqual(resetToken, resetData.resetToken)) {
      await logAuditEvent(db, {
        type:     'change_password_invalid_token',
        email,
        ip,
        metadata: { action: 'changePassword' },
      });
      throw new HttpsError('permission-denied', 'Invalid reset token. Please start over.');
    }

    // ── Update Firebase Auth password ────────────────────────────────────────
    let authUser: admin.auth.UserRecord;
    try {
      authUser = await admin.auth().getUserByEmail(email);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/user-not-found') {
        throw new HttpsError('not-found', 'No account found with this email.');
      }
      throw new HttpsError('internal', 'Could not locate account. Please try again.');
    }

    await admin.auth().updateUser(authUser.uid, { password: newPassword });

    // ── Revoke all existing sessions ─────────────────────────────────────────
    // Forces any sessions opened with the old password to sign out.
    await admin.auth().revokeRefreshTokens(authUser.uid);

    // ── Consume the reset token (single-use) ─────────────────────────────────
    await resetDocRef.delete();

    // ── Update Firestore user doc (updatedAt) ─────────────────────────────────
    try {
      const lookupSnap = await db.collection('userLookup').doc(authUser.uid).get();
      if (lookupSnap.exists) {
        const { customId } = lookupSnap.data() as { customId: string };
        await db.collection('users').doc(customId).update({
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      // Non-fatal — password is already changed in Auth
      console.error('[changePassword] Firestore user update failed (non-fatal):', err);
    }

    await logAuditEvent(db, {
      type:     'password_changed',
      email,
      ip,
      metadata: { action: 'changePassword', uid: authUser.uid },
    });

    return { success: true };
  },
);