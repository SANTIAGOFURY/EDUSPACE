// functions/src/utils/mailer.ts

import { defineSecret } from 'firebase-functions/params';

export const BREVO_API_KEY = defineSecret('BREVO_API_KEY');

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

export interface BrevoEmailOptions {
  to:      string;
  subject: string;
  html:    string;
  apiKey:  string;
}

export async function sendBrevoEmail({
  to,
  subject,
  html,
  apiKey,
}: BrevoEmailOptions): Promise<void> {
  if (!apiKey) throw new Error('BREVO_API_KEY is not set.');

  const payload = {
    to:          [{ email: to }],
    sender:      { email: 'alltecagency5@gmail.com', name: 'EduSpace' },
    subject,
    htmlContent: html,
  };

  console.log('[mailer] Sending email to:', to, '| subject:', subject);

  const res = await fetch(BREVO_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key':      apiKey,
      accept:         'application/json',
    },
    body: JSON.stringify(payload),
  });

  const responseText = await res.text();
  console.log('[mailer] Brevo response:', res.status, responseText);

  if (!res.ok) {
    throw new Error(`Brevo send failed: HTTP ${res.status} — ${responseText}`);
  }
}

// ─── Email templates ──────────────────────────────────────────────────────────

/**
 * Used by sendVerificationCode — email address verification at registration
 * and on first sign-in.
 */
export function buildVerificationEmail(code: string, expiresInMinutes: number): {
  subject: string;
  html:    string;
} {
  return {
    subject: 'Your EduSpace verification code',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#6366f1);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:8px;">
                <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-block;"></div>
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">EduSpace</span>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.3px;">
                Verify your email
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
                Enter the code below to complete your registration. It expires in
                <strong style="color:#111827;">${expiresInMinutes} minutes</strong>.
              </p>

              <!-- Code box -->
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:24px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#9ca3af;letter-spacing:1px;text-transform:uppercase;">
                  Verification code
                </p>
                <p style="margin:0;font-size:40px;font-weight:800;color:#4f46e5;letter-spacing:10px;font-family:'Courier New',monospace;">
                  ${code}
                </p>
              </div>

              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
                If you didn't request this, you can safely ignore this email.
                Someone may have entered your email address by mistake.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#d1d5db;text-align:center;">
                © ${new Date().getFullYear()} EduSpace. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
}

/**
 * Used exclusively by sendResetCode — password reset flow.
 * Intentionally different visual treatment (amber/orange accent) so users
 * can immediately distinguish a reset email from a sign-up verification email.
 */
export function buildResetEmail(code: string, expiresInMinutes: number): {
  subject: string;
  html:    string;
} {
  return {
    subject: 'Reset your EduSpace password',
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- Header — amber/orange to distinguish from verification emails -->
          <tr>
            <td style="background:linear-gradient(135deg,#d97706,#f59e0b);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:8px;">
                <div style="width:32px;height:32px;background:rgba(255,255,255,0.2);border-radius:8px;display:inline-block;"></div>
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">EduSpace</span>
              </div>
            </td>
          </tr>

          <!-- Lock icon row -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <div style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:14px;background:#fffbeb;border:1.5px solid #fde68a;">
                <!-- Lock SVG -->
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:20px 40px 32px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;letter-spacing:-0.3px;text-align:center;">
                Reset your password
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;text-align:center;">
                Use the code below to set a new password. It expires in
                <strong style="color:#111827;">${expiresInMinutes} minutes</strong>.
              </p>

              <!-- Code box — amber accent -->
              <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#92400e;letter-spacing:1px;text-transform:uppercase;">
                  Password reset code
                </p>
                <p style="margin:0;font-size:40px;font-weight:800;color:#d97706;letter-spacing:10px;font-family:'Courier New',monospace;">
                  ${code}
                </p>
              </div>

              <!-- Security notice -->
              <div style="background:#f9fafb;border-left:3px solid #e5e7eb;border-radius:0 6px 6px 0;padding:12px 16px;margin-bottom:20px;">
                <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.6;">
                  <strong style="color:#374151;">Didn't request this?</strong> Your password has
                  <em>not</em> been changed. You can safely ignore this email — no action is needed.
                  If you're concerned, consider updating your password.
                </p>
              </div>

              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;text-align:center;">
                For your security, this code can only be used once and expires after
                ${expiresInMinutes} minutes.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 32px;border-top:1px solid #f3f4f6;">
              <p style="margin:0;font-size:12px;color:#d1d5db;text-align:center;">
                © ${new Date().getFullYear()} EduSpace. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  };
}