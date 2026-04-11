// ─────────────────────────────────────────────────────────────────────────────
// checkAuthorizedUser.ts
// ─────────────────────────────────────────────────────────────────────────────
//
// Called by the frontend in two situations:
//
//   1. Email/password signup — after the user types their email, before they
//      are allowed to proceed through the signup flow.
//
//   2. Google sign-in — ONLY for brand-new users (no Firestore profile found
//      via resolveCustomId). Returning Google users bypass this function
//      entirely on the frontend.
//
// This function intentionally does NOT check whether a Firebase Auth account
// already exists for the email because:
//
//   • Google sign-in always creates a Firebase Auth account before this
//     function is called, so such a check would always throw 'already-exists'
//     for new Google users, incorrectly blocking them.
//
//   • Returning users are short-circuited on the frontend (resolveCustomId
//     finds their profile and never reaches this function).
//
//   • Duplicate email/password registrations are already prevented by
//     Firebase Auth itself (auth/email-already-in-use).
//
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
      'This email is not authorised to access this app. Contact your administrator.',
    );
  }

  // ── Authorized ────────────────────────────────────────────────────────────
  return {
    authorized: true,
    remaining:  rateLimit.remaining,
    meta:       authorizedDoc.data() ?? {},
  };
});