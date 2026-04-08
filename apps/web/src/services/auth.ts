// ─────────────────────────────────────────────────────────────────────────────
// services/auth.ts
// ─────────────────────────────────────────────────────────────────────────────

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type User,
  type AuthError,
} from 'firebase/auth';
import { httpsCallable, type HttpsCallableResult } from 'firebase/functions';

import { auth, fns, googleProvider } from './firebase';
import { resolveCustomId, getUserProfileByCustomId } from './db';

// ─── Callable references ──────────────────────────────────────────────────────

const createUserProfileFn      = httpsCallable(fns, 'createUserProfile');
const checkAuthorizedUserFn    = httpsCallable(fns, 'checkAuthorizedUser');
const validateSignupFn         = httpsCallable(fns, 'validateSignup');
const completeProfileFn        = httpsCallable(fns, 'completeProfile');
const sendVerificationCodeFn   = httpsCallable(fns, 'sendVerificationCode');
const resendVerificationCodeFn = httpsCallable(fns, 'resendVerificationCode');
const verifyVerificationCodeFn = httpsCallable(fns, 'verifyVerificationCode');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthorizedUserMeta {
  addedBy?: string;
  addedAt?: unknown;
}

// ─── AppError ─────────────────────────────────────────────────────────────────

export class AppError extends Error {
  public readonly i18nKey:       string;
  public readonly detail?:       string;
  public readonly originalCode?: string;

  constructor(i18nKey: string, detail?: string, originalCode?: string) {
    super(i18nKey);
    this.name         = 'AppError';
    this.i18nKey      = i18nKey;
    this.detail       = detail;
    this.originalCode = originalCode;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function extractCode(err: unknown): string {
  if (err instanceof AppError) return err.originalCode ?? err.i18nKey;
  const maybeCode = (err as { code?: string })?.code;
  if (typeof maybeCode === 'string' && maybeCode.length > 0) return maybeCode;
  const maybeDetails = (err as { details?: { code?: string } })?.details?.code;
  if (typeof maybeDetails === 'string' && maybeDetails.length > 0) return maybeDetails;
  return 'internal';
}

function extractServerMessage(err: unknown): string | undefined {
  const msg = (err as { message?: string })?.message;
  if (typeof msg === 'string' && msg.length > 0 && !msg.startsWith('internal')) return msg;
  return undefined;
}

function isPassthroughMessage(msg: string): boolean {
  return (
    msg.includes('attempt')              ||
    msg.includes('expired')              ||
    msg.includes('Invalid verification') ||
    msg.includes('Too many')             ||
    msg.includes('Please wait')
  );
}

async function callFn<T = unknown>(
  fn: (data: unknown) => Promise<HttpsCallableResult<unknown>>,
  data: unknown,
): Promise<T> {
  try {
    const result = await fn(data);
    return result.data as T;
  } catch (err) {
    const code      = extractCode(err);
    const serverMsg = extractServerMessage(err);
    const i18nKey   = serverMsg && isPassthroughMessage(serverMsg)
      ? serverMsg
      : getFirebaseErrorKey(code);
    throw new AppError(i18nKey, serverMsg, code);
  }
}

// ─── Email verification ───────────────────────────────────────────────────────

export async function sendVerificationCode(
  email: string,
): Promise<{ expiresInMinutes: number }> {
  return callFn<{ expiresInMinutes: number }>(sendVerificationCodeFn, { email });
}

export async function resendVerificationCode(
  email: string,
): Promise<{ expiresInMinutes: number }> {
  return callFn<{ expiresInMinutes: number }>(resendVerificationCodeFn, { email });
}

export async function verifyVerificationCode(
  email: string,
  code: string,
): Promise<void> {
  await callFn(verifyVerificationCodeFn, { email, code });
}

// ─── Auth checks ──────────────────────────────────────────────────────────────

export async function checkAuthorizedUser(email: string): Promise<{
  authorized: boolean;
  meta: AuthorizedUserMeta;
}> {
  return callFn<{ authorized: boolean; meta: AuthorizedUserMeta }>(
    checkAuthorizedUserFn,
    { email },
  );
}

export async function validateSignupEmail(email: string): Promise<void> {
  await callFn(validateSignupFn, { email });
}

// ─── signUpWithEmail ──────────────────────────────────────────────────────────

export async function signUpWithEmail(
  email:     string,
  password:  string,
  firstName: string,
  lastName:  string,
  username:  string,
  birthday:  string,
): Promise<User> {
  let user: User;

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    user = cred.user;
  } catch (err) {
    const code = extractCode(err);
    throw new AppError(getFirebaseErrorKey(code), undefined, code);
  }

  try {
    await updateProfile(user, { displayName: `${firstName} ${lastName}` });
  } catch {
    console.warn('signUpWithEmail: updateProfile failed (non-fatal)');
  }

  try {
    await user.getIdToken(true);
  } catch {
    console.warn('signUpWithEmail: pre-call token refresh failed (non-fatal)');
  }

  try {
    await createUserProfileFn({
      email,
      provider:    'password',
      displayName: `${firstName} ${lastName}`,
      firstName,
      lastName,
      username,
      birthday,
      photoURL:    '',
    });
  } catch (err) {
    try { await user.delete(); } catch { /* ignore */ }
    const code      = extractCode(err);
    const serverMsg = extractServerMessage(err);
    throw new AppError(getFirebaseErrorKey(code), serverMsg, code);
  }

  try {
    await user.getIdToken(true);
  } catch {
    console.warn('signUpWithEmail: post-call token refresh failed (non-fatal)');
  }

  return user;
}

// ─── signInWithEmail ──────────────────────────────────────────────────────────

export async function signInWithEmail(
  email:    string,
  password: string,
): Promise<{ user: User; needsVerification: boolean }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    if (!cred.user.emailVerified) {
      await signOut(auth);
      return { user: cred.user, needsVerification: true };
    }

    return { user: cred.user, needsVerification: false };
  } catch (err) {
    const code = extractCode(err);
    throw new AppError(getFirebaseErrorKey(code), undefined, code);
  }
}

// ─── signInWithGoogle ─────────────────────────────────────────────────────────

export async function signInWithGoogle(): Promise<{
  user:         User;
  needsProfile: boolean;
} | null> {
  let user: User;

  try {
    const cred = await signInWithPopup(auth, googleProvider);
    user = cred.user;
  } catch (err) {
    const code = extractCode(err);
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/cancelled-popup-request'
    ) {
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw new AppError(getFirebaseErrorKey(code), undefined, code);
  }

  return finaliseGoogleSignIn(user);
}

export async function handleGoogleRedirectResult(): Promise<{
  user:         User;
  needsProfile: boolean;
} | null> {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;
    return finaliseGoogleSignIn(result.user);
  } catch (err) {
    const code = extractCode(err);
    throw new AppError(getFirebaseErrorKey(code), undefined, code);
  }
}

/**
 * Called after every successful Google OAuth sign-in (popup or redirect).
 *
 * Decision tree:
 *
 *  A) Returning user (userLookup doc already exists + profileComplete=true)
 *     → Skip the authorization gate. Just sign them in.
 *
 *  B) Returning user mid-onboarding (userLookup exists but profileComplete=false)
 *     → Skip the authorization gate. Let them finish their profile.
 *
 *  C) Brand-new user (no userLookup doc)
 *     → Run checkAuthorizedUser first.
 *       • Not authorized  → sign out immediately, throw signupBlocked error.
 *       • Authorized      → create profile stub, return needsProfile: true.
 *
 * Why this order matters:
 *   checkAuthorizedUser also throws 'already-exists' when a Firebase Auth
 *   account already exists for the email. For Google sign-ins the account
 *   always exists (Google just authenticated them), so calling
 *   checkAuthorizedUser on a returning user would always throw. We must
 *   check for an existing profile FIRST and short-circuit before hitting
 *   the authorization function.
 */
async function finaliseGoogleSignIn(user: User): Promise<{
  user:         User;
  needsProfile: boolean;
}> {
  const email = user.email ?? '';

  // ── Case A & B: check for an existing Firestore profile ──────────────────
  try {
    const customId = await resolveCustomId(user.uid);

    if (customId) {
      const profileSnap     = await getUserProfileByCustomId(customId);
      const data            = profileSnap.data();
      const profileComplete = data?.profileComplete ?? false;

      // Case A — fully onboarded returning user
      if (profileComplete) return { user, needsProfile: false };

      // Case B — started onboarding but never finished
      return { user, needsProfile: true };
    }
  } catch {
    // resolveCustomId throws when the lookup doc doesn't exist yet.
    // This means it's a brand-new user → fall through to Case C.
  }

  // ── Case C: brand-new user — enforce the authorization allowlist ──────────
  //
  // checkAuthorizedUser will:
  //   • throw 'permission-denied'  → email not in authorizedUsers
  //   • throw 'already-exists'     → Firebase Auth account exists (won't happen
  //                                   here because we only reach this branch when
  //                                   resolveCustomId found no Firestore doc, but
  //                                   guard it anyway)
  //   • return normally            → authorized and ready to create a profile
  try {
    await checkAuthorizedUser(email);
  } catch (err) {
    // Unauthorized or any unexpected error:
    // sign the user out immediately so they don't sit in a half-authenticated
    // state, then surface the error to the UI.
    try { await signOut(auth); } catch { /* ignore */ }
    throw err; // already an AppError from callFn
  }

  // ── Authorized — create the stub profile ─────────────────────────────────
  try {
    await createUserProfileFn({
      email,
      provider:    'google.com',
      displayName: user.displayName ?? '',
      photoURL:    user.photoURL    ?? '',
    });
  } catch (err) {
    const code = extractCode(err);
    // 'already-exists' is a harmless race condition: two tabs finishing at the
    // same time. Safe to continue.
    if (code !== 'already-exists') {
      try { await signOut(auth); } catch { /* ignore */ }
      throw new AppError(getFirebaseErrorKey(code), undefined, code);
    }
  }

  try {
    await user.getIdToken(true);
  } catch {
    console.warn('finaliseGoogleSignIn: token refresh failed (non-fatal)');
  }

  return { user, needsProfile: true };
}

// ─── completeUserProfile ──────────────────────────────────────────────────────

export async function completeUserProfile(data: {
  firstName: string;
  lastName:  string;
  username:  string;
  birthday:  string;
  phone?:    string;
}): Promise<void> {
  await callFn(completeProfileFn, data);
  try {
    await auth.currentUser?.getIdToken(true);
  } catch {
    console.warn('completeUserProfile: token refresh failed (non-fatal)');
  }
}

// ─── resetPassword ────────────────────────────────────────────────────────────

export async function resetPassword(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    const code = extractCode(err);
    throw new AppError(getFirebaseErrorKey(code), undefined, code);
  }
}

// ─── logOut ───────────────────────────────────────────────────────────────────

export async function logOut(): Promise<void> {
  try {
    await signOut(auth);
  } catch (err) {
    const code = extractCode(err);
    throw new AppError(getFirebaseErrorKey(code), undefined, code);
  }
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { onAuthStateChanged };
export type { User, AuthError };

// ─── getFirebaseErrorKey ──────────────────────────────────────────────────────

export function getFirebaseErrorKey(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-credential':                       'errors.invalidCredentials',
    'auth/wrong-password':                           'errors.invalidCredentials',
    'auth/user-not-found':                           'errors.invalidCredentials',
    'auth/invalid-email':                            'errors.emailInvalid',
    'auth/email-already-in-use':                     'errors.emailInUse',
    'auth/weak-password':                            'errors.weakPassword',
    'auth/network-request-failed':                   'errors.networkError',
    'auth/too-many-requests':                        'errors.tooManyRequests',
    'auth/popup-closed-by-user':                     'errors.popupClosed',
    'auth/cancelled-popup-request':                  'errors.popupClosed',
    'auth/popup-blocked':                            'errors.popupBlocked',
    'auth/account-exists-with-different-credential': 'errors.accountExistsDifferentProvider',
    'auth/requires-recent-login':                    'errors.requiresRecentLogin',
    'auth/user-disabled':                            'errors.userDisabled',
    'auth/operation-not-allowed':                    'errors.operationNotAllowed',
    'auth/expired-action-code':                      'errors.expiredActionCode',
    'auth/invalid-action-code':                      'errors.invalidActionCode',
    'already-exists':                                'errors.emailInUse',
    'resource-exhausted':                            'errors.tooManyRequests',
    'permission-denied':                             'errors.signupBlocked',
    'unauthenticated':                               'errors.unauthenticated',
    'invalid-argument':                              'errors.invalidArgument',
    'internal':                                      'errors.genericError',
    'not-found':                                     'errors.notFound',
    'unavailable':                                   'errors.serviceUnavailable',
    'deadline-exceeded':                             'errors.codeExpired',
    'failed-precondition':                           'errors.emailNotVerified',
    'out-of-range':                                  'errors.invalidArgument',
    'unimplemented':                                 'errors.genericError',
    'data-loss':                                     'errors.genericError',
    'aborted':                                       'errors.genericError',
  };
  return map[code] ?? 'errors.genericError';
}