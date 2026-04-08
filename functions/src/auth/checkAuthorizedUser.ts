// ─────────────────────────────────────────────────────────────────────────────
// checkAuthorizedUser.ts
// ─────────────────────────────────────────────────────────────────────────────
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { isValidEmail, checkRateLimit, logAuditEvent } from '../helpers';

const db = admin.firestore();

export const checkAuthorizedUser = onCall(async (request) => {
  const ip    = request.rawRequest?.ip ?? 'unknown';
  const email = String(request.data?.email ?? '').trim().toLowerCase();

  // ── Basic validation before spending a rate-limit slot ───────────────────
  if (!email) {
    throw new HttpsError('invalid-argument', 'Please enter your email address.');
  }
  if (!isValidEmail(email)) {
    throw new HttpsError('invalid-argument', 'Please enter a valid email address.');
  }

  // ── Rate limit: 10 checks per IP per hour ─────────────────────────────────
  const rateLimit = await checkRateLimit(db, `checkAuth:${ip}`, 10, 3600);
  if (!rateLimit.allowed) {
    await logAuditEvent(db, {
      type:     'rate_limited',
      ip,
      metadata: { action: 'checkAuthorizedUser', email },
    });
    throw new HttpsError(
      'resource-exhausted',
      'Too many attempts. Please wait an hour before trying again.',
    );
  }

  // ── Check authorizedUsers collection ──────────────────────────────────────
  const authorizedDoc = await db.collection('authorizedUsers').doc(email).get();

  if (!authorizedDoc.exists) {
    await logAuditEvent(db, {
      type:     'unauthorized_signup_attempt',
      email,
      ip,
      metadata: { action: 'checkAuthorizedUser' },
    });
    throw new HttpsError(
      'permission-denied',
      'This email address is not authorised to sign up. Please contact your administrator.',
    );
  }

  // ── Authorized ────────────────────────────────────────────────────────────
  // NOTE: We intentionally do NOT check whether a Firebase Auth account
  // already exists for this email. That check was removed because:
  //
  //   1. Google sign-in always creates a Firebase Auth account before this
  //      function is called, so the check would always throw 'already-exists'
  //      for new Google users, incorrectly blocking them.
  //
  //   2. The frontend now handles the "already registered" case by checking
  //      Firestore first (resolveCustomId) before calling this function.
  //      If a Firestore profile exists the frontend short-circuits and never
  //      reaches this function. If no Firestore profile exists the user is
  //      genuinely new, regardless of whether a Firebase Auth record exists.
  //
  //   3. Duplicate registration for email/password users is already prevented
  //      by Firebase Auth itself (auth/email-already-in-use).

  return {
    authorized: true,
    remaining:  rateLimit.remaining,
    meta:       authorizedDoc.data() ?? {},
  };
});