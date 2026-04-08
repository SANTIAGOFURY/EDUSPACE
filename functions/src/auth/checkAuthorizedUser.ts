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
    // Use permission-denied so the client can show a specific "not authorized" message
    throw new HttpsError(
      'permission-denied',
      'This email address is not authorised to sign up. Please contact your administrator.',
    );
  }
 
  // ── Check if already registered ──────────────────────────────────────────
  try {
    await admin.auth().getUserByEmail(email);
    // User exists → already-exists so the client shows "already registered" UX
    throw new HttpsError(
      'already-exists',
      'An account with this email already exists. Please sign in instead.',
    );
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'auth/user-not-found') {
      // All good: authorized and not yet registered
      return {
        authorized: true,
        remaining:  rateLimit.remaining,
        meta:       authorizedDoc.data() ?? {},
      };
    }
    // Re-throw our own HttpsError unchanged
    if (err instanceof HttpsError) throw err;
 
    // Unexpected error
    console.error('checkAuthorizedUser: unexpected error:', err);
    throw new HttpsError(
      'internal',
      'Something went wrong while checking your email. Please try again.',
    );
  }
});
 
 