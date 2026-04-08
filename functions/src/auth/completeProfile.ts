// ─────────────────────────────────────────────────────────────────────────────
// completeProfile.ts
// ─────────────────────────────────────────────────────────────────────────────
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sanitizeUserData, isValidName, checkRateLimit, logAuditEvent } from '../helpers';
 
const db = admin.firestore();
 
export const completeProfile = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'You must be signed in to perform this action.');
  }
 
  const uid = request.auth.uid;
  const ip  = request.rawRequest?.ip ?? 'unknown';
 
  // ── Rate limit ────────────────────────────────────────────────────────────
  const rateLimit = await checkRateLimit(db, `completeProfile:${uid}`, 5, 600);
  if (!rateLimit.allowed) {
    await logAuditEvent(db, {
      type:     'rate_limited',
      uid,
      metadata: { action: 'completeProfile' },
    });
    throw new HttpsError(
      'resource-exhausted',
      'Too many attempts. Please wait a few minutes and try again.',
    );
  }
 
  // ── Resolve customId from lookup ──────────────────────────────────────────
  const lookupSnap = await db.collection('userLookup').doc(uid).get();
  if (!lookupSnap.exists) {
    // Lookup doc missing – instruct the client to sign out and back in
    throw new HttpsError(
      'not-found',
      'Your account record was not found. Please sign out and sign in again.',
    );
  }
  const { customId } = lookupSnap.data() as { customId: string };
 
  // ── Validate input ────────────────────────────────────────────────────────
  const sanitized = sanitizeUserData(request.data);
 
  if (!isValidName(sanitized.firstName)) {
    throw new HttpsError(
      'invalid-argument',
      'Please enter a valid first name (2–50 characters, letters only).',
    );
  }
  if (!isValidName(sanitized.lastName)) {
    throw new HttpsError(
      'invalid-argument',
      'Please enter a valid last name (2–50 characters, letters only).',
    );
  }
  if (!['student', 'teacher'].includes(sanitized.role)) {
    throw new HttpsError('invalid-argument', 'Please select a valid role.');
  }
 
  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
 
    // All Firestore + Auth writes in parallel where safe
    await Promise.all([
      db.collection('users').doc(customId).update({
        firstName:       sanitized.firstName,
        lastName:        sanitized.lastName,
        displayName:     sanitized.displayName,
        role:            sanitized.role,
        ...(sanitized.phone ? { phone: sanitized.phone } : {}),
        profileComplete: true,
        updatedAt:       now,
      }),
      admin.auth().updateUser(uid, { displayName: sanitized.displayName }),
      admin.auth().setCustomUserClaims(uid, {
        role:            sanitized.role,
        customId,
        profileComplete: true,
      }),
    ]);
 
    await logAuditEvent(db, {
      type:     'profile_complete',
      uid,
      ip,
      metadata: { role: sanitized.role, customId },
    });
 
    return { success: true, displayName: sanitized.displayName };
  } catch (err) {
    console.error(`completeProfile failed for uid=${uid}:`, err);
    throw new HttpsError(
      'internal',
      'We could not save your profile. Please try again.',
    );
  }
});
 
 