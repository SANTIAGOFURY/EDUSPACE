// ─────────────────────────────────────────────────────────────────────────────
// validateSignup.ts
// ─────────────────────────────────────────────────────────────────────────────
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { isValidEmail, checkRateLimit, detectSuspiciousSignup, logAuditEvent } from '../helpers';
 
const db = admin.firestore();
 
export const validateSignup = onCall(async (request) => {
  const ip        = request.rawRequest?.ip ?? 'unknown';
  const userAgent = request.rawRequest?.headers?.['user-agent'] ?? '';
  const email     = String(request.data?.email ?? '').trim().toLowerCase();
 
  // ── Validate before spending rate-limit slot ──────────────────────────────
  if (!email || !isValidEmail(email)) {
    throw new HttpsError('invalid-argument', 'A valid email address is required.');
  }
 
  // ── Rate limit: 10 signups per IP per hour ────────────────────────────────
  const rateLimit = await checkRateLimit(db, `signup:${ip}`, 10, 3600);
  if (!rateLimit.allowed) {
    await logAuditEvent(db, {
      type:     'rate_limited',
      ip,
      metadata: { action: 'signup', userAgent },
    });
    throw new HttpsError(
      'resource-exhausted',
      'Too many sign-up attempts from your network. Please try again later.',
    );
  }
 
  // ── Suspicious activity / bot check ──────────────────────────────────────
  const suspicious = detectSuspiciousSignup({ email, ip, userAgent });
  if (suspicious.suspicious) {
    await logAuditEvent(db, {
      type:     'suspicious_activity',
      email,
      ip,
      metadata: { reasons: suspicious.reasons, userAgent },
    });
    throw new HttpsError(
      'permission-denied',
      'Sign-up is temporarily unavailable for your request. Please try again later or contact support.',
    );
  }
 
  return { valid: true, remaining: rateLimit.remaining };
});
 