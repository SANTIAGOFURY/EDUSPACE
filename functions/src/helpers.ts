import * as admin from 'firebase-admin';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface PasswordStrengthResult {
  score: number; // 0-4
  feedback: string[];
  isStrong: boolean;
}

export interface SanitizedUserData {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string;
  role: 'student' | 'teacher';
  phone?: string;
}

// ─── Audit event types ────────────────────────────────────────────────────────

// ─── Audit event types ────────────────────────────────────────────────────────

export type AuditEventType =
  | 'signup'
  | 'login'
  | 'logout'
  | 'profile_complete'
  | 'password_reset'
  | 'suspicious_activity'
  | 'rate_limited'
  | 'unauthorized_signup_attempt'
  | 'unauthorized_verification_attempt'
  | 'verification_code_sent'
  | 'verification_code_failed'
  | 'verification_code_verified'
  | 'verification_code_resent'
  | 'unauthorized_resend_attempt'
  | 'verification_code_expired'
  | 'verification_code_blocked'
  | 'reset_code_sent'
  | 'reset_code_verified'
  | 'reset_code_expired'
  | 'reset_code_failed'
  | 'reset_code_blocked'
  | 'reset_code_unknown_email'
  | 'password_changed'
  | 'change_password_invalid_token';

// ─── Sanitization ─────────────────────────────────────────────────────────────

export function sanitizeString(input: string): string {
  return input
    .trim()
    .replace(/[<>'"&]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

export function sanitizeEmail(email: string): string {
  return email.trim().toLowerCase().slice(0, 254);
}

export function sanitizeUserData(data: Record<string, unknown>): SanitizedUserData {
  const firstName = sanitizeString(String(data.firstName ?? ''));
  const lastName  = sanitizeString(String(data.lastName ?? ''));
  const email     = sanitizeEmail(String(data.email ?? ''));
  const role      = data.role === 'teacher' ? 'teacher' : 'student';
  const phone     = data.phone ? sanitizeString(String(data.phone)).slice(0, 20) : undefined;

  return {
    firstName,
    lastName,
    displayName: `${firstName} ${lastName}`,
    email,
    role,
    ...(phone ? { phone } : {}),
  };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  const re = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return re.test(email) && email.length <= 254;
}

export function isValidName(name: string): boolean {
  return name.length >= 2 && name.length <= 50 && /^[\p{L}\s'\-]+$/u.test(name);
}

export function isValidPhone(phone: string): boolean {
  return /^\+?[\d\s\-()]{7,20}$/.test(phone);
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  else feedback.push('At least 8 characters required');

  if (password.length >= 12) score++;
  else if (password.length >= 8) feedback.push('12+ characters recommended');

  if (/[A-Z]/.test(password)) score++;
  else feedback.push('Add uppercase letters');

  if (/[0-9]/.test(password)) score++;
  else feedback.push('Add numbers');

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else feedback.push('Add special characters (!@#$...)');

  if (/^(.)\1+$/.test(password))              { score = 0; feedback.push('Too repetitive'); }
  if (/^(123|abc|qwerty|password)/i.test(password)) { score = 0; feedback.push('Too common'); }

  return { score: Math.min(score, 4), feedback, isStrong: score >= 3 };
}

// ─── Rate limiting (Firestore-based) ─────────────────────────────────────────

const RATE_LIMIT_COLLECTION = '_rateLimits';

export async function checkRateLimit(
  db: admin.firestore.Firestore,
  key: string,
  maxAttempts: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  const ref = db.collection(RATE_LIMIT_COLLECTION).doc(key);
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  return db.runTransaction(async (tx) => {
    const doc  = await tx.get(ref);
    const data = doc.data() ?? { attempts: 0, windowStart: now };

    if (now - data.windowStart > windowMs) {
      data.attempts    = 0;
      data.windowStart = now;
    }

    data.attempts += 1;
    const resetAt = data.windowStart + windowMs;

    tx.set(ref, { ...data, updatedAt: now }, { merge: true });

    return {
      allowed:   data.attempts <= maxAttempts,
      remaining: Math.max(0, maxAttempts - data.attempts),
      resetAt,
    };
  });
}

// ─── Suspicious activity detection ───────────────────────────────────────────

export function detectSuspiciousSignup(data: {
  email: string;
  ip?: string;
  userAgent?: string;
}): { suspicious: boolean; reasons: string[] } {
  const reasons: string[] = [];

  const disposableDomains = [
    'mailinator.com', 'tempmail.com', 'throwaway.email',
    'guerrillamail.com', 'sharklasers.com', 'yopmail.com',
    '10minutemail.com', 'trashmail.com', 'fakeinbox.com',
  ];

  const domain = data.email.split('@')[1]?.toLowerCase() ?? '';
  if (disposableDomains.includes(domain)) {
    reasons.push('Disposable email domain detected');
  }

  if (!data.userAgent || data.userAgent.length < 10) {
    reasons.push('Missing or suspicious user agent');
  }

  return { suspicious: reasons.length > 0, reasons };
}

// ─── Audit logging ────────────────────────────────────────────────────────────

export async function logAuditEvent(
  db: admin.firestore.Firestore,
  event: {
    type: AuditEventType;   // ← uses the exported type, easy to extend
    uid?: string;
    email?: string;
    ip?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await db.collection('_auditLog').add({
    ...event,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: Date.now(),
  });
}