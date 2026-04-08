import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { generateUserId } from '../utils/idGenerator';
import { logAuditEvent } from '../helpers';

const db = admin.firestore();

export const createUserProfile = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'You must be signed in to perform this action.');
    }

    const uid      = request.auth.uid;
    const email    = String(request.data?.email    ?? '').trim().toLowerCase();
    const provider = String(request.data?.provider ?? 'password');
    const isGoogle = provider === 'google.com';

    // ── Validate email ────────────────────────────────────────────────────────
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpsError('invalid-argument', 'A valid email address is required.');
    }

    // ── Idempotency — return early if profile already exists ─────────────────
    const existing = await db.collection('userLookup').doc(uid).get();
    if (existing.exists) {
      return { success: true, customId: existing.data()?.customId };
    }

    // ── Email/password: require verified code ─────────────────────────────────
    // Check AFTER idempotency so retries don't re-check a consumed code.
    if (!isGoogle) {
      const verifySnap = await db
        .collection('emailVerificationCodes')
        .doc(email)
        .get();

      const isVerified =
        verifySnap.exists &&
        (verifySnap.data() as { verified?: boolean }).verified === true;

      if (!isVerified) {
        throw new HttpsError(
          'failed-precondition',
          'Please verify your email address before completing registration.',
        );
      }
    }

    // ── Build profile fields ──────────────────────────────────────────────────
    const customId    = generateUserId();
    const displayName = String(request.data?.displayName ?? '').trim();
    const photoURL    = String(request.data?.photoURL    ?? '').trim();
    const nameParts   = displayName.split(' ');

    // For Google: parse name from displayName. For email: names come later via
    // completeProfile (they are already in the Firestore doc after RegisterForm).
    const firstName = isGoogle ? (nameParts[0] ?? '') : String(request.data?.firstName ?? '').trim();
    const lastName  = isGoogle ? nameParts.slice(1).join(' ') : String(request.data?.lastName ?? '').trim();

    // Role: email signup passes role explicitly; Google defaults to student
    // until completeProfile runs.
    const role = !isGoogle && request.data?.role === 'teacher' ? 'teacher' : 'student';

    try {
      const now   = admin.firestore.FieldValue.serverTimestamp();
      const batch = db.batch();

      batch.set(db.collection('users').doc(customId), {
        id:              customId,
        uid,
        email,
        displayName:     displayName || `${firstName} ${lastName}`.trim(),
        firstName,
        lastName,
        photoURL,
        phone:           '',
        role,
        provider,
        profileComplete: !isGoogle,   // Google users complete profile via modal
        emailVerified:   true,        // email/password verified via code; Google inherently verified
        isActive:        true,
        isVerified:      true,
        createdAt:       now,
        updatedAt:       now,
        lastLoginAt:     now,
        preferences: {
          language:      'en',
          theme:         'light',
          notifications: { email: true, push: false },
        },
        stats: {
          coursesEnrolled:   0,
          coursesCompleted:  0,
          quizzesTaken:      0,
          averageScore:      0,
          totalTimeSpentMin: 0,
        },
      });

      batch.set(db.collection('userLookup').doc(uid), {
        customId,
        email,
        createdAt: now,
      });

      await batch.commit();

      // Mark emailVerified on the Auth user
      await admin.auth().updateUser(uid, { emailVerified: true });

      // Write custom claims so the client token reflects the role immediately
      await admin.auth().setCustomUserClaims(uid, {
        role,
        customId,
        profileComplete: !isGoogle,
        emailVerified:   true,
      });

      await logAuditEvent(db, {
        type:     'signup',
        uid,
        email,
        metadata: { provider, isGoogle, customId, role },
      });

      return { success: true, customId };
    } catch (err) {
      console.error(`createUserProfile failed for uid=${uid}:`, err);
      throw new HttpsError('internal', 'We could not create your account. Please try again.');
    }
  },
);