// ─────────────────────────────────────────────────────────────────────────────
// services/auth.ts  (updated — resendVerificationCode added)
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

const createUserProfileFn       = httpsCallable(fns, 'createUserProfile');
const checkAuthorizedUserFn     = httpsCallable(fns, 'checkAuthorizedUser');
const validateSignupFn          = httpsCallable(fns, 'validateSignup');
const completeProfileFn         = httpsCallable(fns, 'completeProfile');
const sendVerificationCodeFn    = httpsCallable(fns, 'sendVerificationCode');
const resendVerificationCodeFn  = httpsCallable(fns, 'resendVerificationCode'); // ← NEW
const verifyVerificationCodeFn  = httpsCallable(fns, 'verifyVerificationCode');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthorizedUserMeta {
  role?:    'student' | 'teacher';
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

/**
 * Messages that should be forwarded verbatim to the UI because they carry
 * user-visible state (attempt counts, wait times, expiry notices).
 */
function isPassthroughMessage(msg: string): boolean {
  return (
    msg.includes('attempt')              ||
    msg.includes('expired')              ||
    msg.includes('Invalid verification') ||
    msg.includes('Too many')             ||
    msg.includes('Please wait')          // server-side cooldown messages
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

/** Called the FIRST time a code is requested (e.g. on registration). */
export async function sendVerificationCode(
  email: string,
): Promise<{ expiresInMinutes: number }> {
  return callFn<{ expiresInMinutes: number }>(sendVerificationCodeFn, { email });
}

/**
 * Called when the user clicks "Resend code" inside the verification modal.
 * Routes to the dedicated resend endpoint which enforces:
 *   - 60 s server-side cooldown
 *   - 3 resends / 10-min email limit
 *   - 10 resends / hour IP limit
 *   - Invalidates the previous code atomically
 */
export async function resendVerificationCode(
  email: string,
): Promise<{ expiresInMinutes: number }> {
  return callFn<{ expiresInMinutes: number }>(resendVerificationCodeFn, { email });
}

/** Verifies the 6-digit code entered by the user. */
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
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  role: 'student' | 'teacher' = 'student',
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
      photoURL:    '',
      role,
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
  email: string,
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
  user: User;
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
  user: User;
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

async function finaliseGoogleSignIn(user: User): Promise<{
  user: User;
  needsProfile: boolean;
}> {
  try {
    await createUserProfileFn({
      email:       user.email       ?? '',
      provider:    'google.com',
      displayName: user.displayName ?? '',
      photoURL:    user.photoURL    ?? '',
    });
  } catch (err) {
    const code = extractCode(err);
    if (code !== 'already-exists') {
      throw new AppError(getFirebaseErrorKey(code), undefined, code);
    }
  }

  try {
    await user.getIdToken(true);
  } catch {
    console.warn('finaliseGoogleSignIn: token refresh failed (non-fatal)');
  }

  try {
    const customId = await resolveCustomId(user.uid);
    if (!customId) return { user, needsProfile: true };

    const profileSnap     = await getUserProfileByCustomId(customId);
    const profileComplete = profileSnap.data()?.profileComplete ?? false;
    return { user, needsProfile: !profileComplete };
  } catch {
    console.warn('finaliseGoogleSignIn: profile check failed, assuming needsProfile=true');
    return { user, needsProfile: true };
  }
}

// ─── completeUserProfile ──────────────────────────────────────────────────────

export async function completeUserProfile(data: {
  firstName: string;
  lastName:  string;
  role:      'student' | 'teacher';
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