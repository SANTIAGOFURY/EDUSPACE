import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { resendVerificationCode, verifyVerificationCode, AppError } from '../../services/auth';

interface EmailVerificationModalProps {
  isOpen:            boolean;
  email:             string;
  onVerified:        () => void;
  onBack:            () => void;
  codeSentAt?:       Date | null;
  expiresInMinutes?: number;
}

const CODE_LENGTH       = 6;
const RESEND_COOLDOWN_S = 60;
const MAX_ATTEMPTS      = 5;
const TOTAL_SECS        = 600;

export function EmailVerificationModal({
  isOpen, email, onVerified, onBack, codeSentAt,
}: EmailVerificationModalProps) {
  const [digits,      setDigits]      = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [error,       setError]       = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isSuccess,   setIsSuccess]   = useState(false);
  const [shake,       setShake]       = useState(false);
  const [cooldown,    setCooldown]    = useState(RESEND_COOLDOWN_S);
  const [expiresSecs, setExpiresSecs] = useState(TOTAL_SECS);
  const [attempts,    setAttempts]    = useState(0);
  const inputRefs       = useRef<Array<HTMLInputElement | null>>(Array(CODE_LENGTH).fill(null));
  const autoVerifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCooldown(RESEND_COOLDOWN_S);
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [isOpen, codeSentAt]);

  useEffect(() => {
    if (!isOpen) return;
    setExpiresSecs(TOTAL_SECS);
    const id = setInterval(() => setExpiresSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [isOpen, codeSentAt]);

  useEffect(() => {
    if (isOpen) {
      setDigits(Array(CODE_LENGTH).fill(''));
      setError('');
      setIsSuccess(false);
      setAttempts(0);
      setTimeout(() => inputRefs.current[0]?.focus(), 180);
    }
  }, [isOpen]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) =>
    a + b.replace(/./g, '•') + c);

  const progressPct = (expiresSecs / TOTAL_SECS) * 100;
  const timerState  = expiresSecs <= 60 ? 'crit' : expiresSecs <= 180 ? 'warn' : 'ok';

  // ── Verify ──────────────────────────────────────────────────────────────
  const handleVerifyCode = useCallback(async (code: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setError('');
    try {
      await verifyVerificationCode(email, code);
      setIsSuccess(true);
      setTimeout(onVerified, 1400);
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      const remaining = MAX_ATTEMPTS - newAttempts;
      const base = err instanceof AppError ? err.i18nKey : 'Invalid code.';
      setError(
        remaining > 0
          ? `${base} ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many attempts. Please request a new code.',
      );
      triggerShake();
      setDigits(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 60);
    } finally {
      setIsVerifying(false);
    }
  }, [email, attempts, isVerifying, onVerified]);

  const handleVerify = useCallback(() => {
    const code = digits.join('');
    if (code.length < CODE_LENGTH) {
      setError('Please enter all 6 digits.');
      triggerShake();
      return;
    }
    handleVerifyCode(code);
  }, [digits, handleVerifyCode]);

  // Auto-submit when all digits filled
  useEffect(() => {
    if (digits.every(d => d !== '') && !isVerifying && !isSuccess) {
      if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current);
      autoVerifyTimer.current = setTimeout(handleVerify, 140);
    }
    return () => { if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current); };
  }, [digits, isVerifying, isSuccess, handleVerify]);

  // ── Input handlers ───────────────────────────────────────────────────────
  const handleChange = useCallback((index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    if (!char) return;
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setError('');
    if (index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }, [digits]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) { next[index] = ''; setDigits(next); }
      else if (index > 0) { next[index - 1] = ''; setDigits(next); inputRefs.current[index - 1]?.focus(); }
      setError('');
      return;
    }
    if (/^\d$/.test(e.key) && digits[index]) {
      const next = [...digits];
      next[index] = e.key;
      setDigits(next);
      setError('');
      if (index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowLeft'  && index > 0)               { e.preventDefault(); inputRefs.current[index - 1]?.focus(); }
    if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) { e.preventDefault(); inputRefs.current[index + 1]?.focus(); }
    if (e.key === 'Enter' && digits.every(d => d !== ''))  handleVerify();
  }, [digits, handleVerify]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    const next = Array(CODE_LENGTH).fill('');
    pasted.split('').forEach((c, i) => { next[i] = c; });
    setDigits(next);
    setError('');
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
    if (pasted.length === CODE_LENGTH) setTimeout(() => handleVerifyCode(next.join('')), 140);
  }, [handleVerifyCode]);

  // ── Resend — now calls the dedicated resend endpoint ────────────────────
  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setError('');
    try {
      // Uses resendVerificationCode (not sendVerificationCode) so the server
      // enforces its own cooldown + invalidates the previous code atomically.
      await resendVerificationCode(email);
      setCooldown(RESEND_COOLDOWN_S);
      setExpiresSecs(TOTAL_SECS);
      setAttempts(0);
      setDigits(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 60);
    } catch (err) {
      // Surface server-side cooldown / rate-limit messages directly
      setError(err instanceof AppError ? err.i18nKey : 'Failed to resend. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const hasError = !!error;

  return (
    <>
      <style>{`
        @keyframes evm-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes evm-pop {
          0%   { transform: scale(0.6); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes evm-ripple {
          0%   { transform: scale(0.8); opacity: 0.6; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes evm-slide-up {
          from { transform: translateY(6px); opacity: 0; }
          to   { transform: translateY(0);   opacity: 1; }
        }
        @keyframes evm-dash {
          to { stroke-dashoffset: 0; }
        }
        .evm-spin     { animation: evm-spin 0.9s linear infinite; }
        .evm-pop      { animation: evm-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .evm-ripple   { animation: evm-ripple 1.4s ease-out infinite; }
        .evm-slide-up { animation: evm-slide-up 0.22s ease forwards; }
        .evm-check    { stroke-dasharray: 28; stroke-dashoffset: 28; animation: evm-dash 0.45s 0.2s ease forwards; }

        .evm-digit { transition: border-color 0.14s ease, background 0.14s ease, transform 0.14s ease; }
        .evm-digit:focus { box-shadow: 0 0 0 3px rgba(99,102,241,0.15); outline: none; }
        .evm-digit-error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }

        .evm-btn-primary {
          position: relative;
          overflow: hidden;
        }
        .evm-btn-primary::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(255,255,255,0.08), transparent);
          pointer-events: none;
        }
        .evm-btn-primary:not(:disabled):hover { filter: brightness(1.08); }
        .evm-btn-primary:not(:disabled):active { transform: scale(0.985); }

        .evm-progress {
          transition: width 1s linear, background-color 0.5s ease;
        }
      `}</style>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              key="evm-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(15,15,30,0.55)' }}
              aria-hidden="true"
            />

            <motion.div
              key="evm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="evm-title"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                className="w-full overflow-hidden"
                style={{
                  maxWidth: 420,
                  borderRadius: 24,
                  background: '#fff',
                  boxShadow: '0 24px 64px rgba(15,15,30,0.18), 0 4px 16px rgba(15,15,30,0.08)',
                }}
                onClick={e => e.stopPropagation()}
              >

                {/* ── Header ── */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                    padding: '24px 24px 20px',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', top: -40, right: -40, width: 160, height: 160,
                      borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.08)',
                    }} />
                    <div style={{
                      position: 'absolute', top: -12, right: -12, width: 88, height: 88,
                      borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.1)',
                    }} />
                    <div style={{
                      position: 'absolute', bottom: -32, left: -20, width: 110, height: 110,
                      borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.06)',
                    }} />
                    <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.06 }}>
                      <pattern id="evm-dots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1.2" fill="white" />
                      </pattern>
                      <rect width="100%" height="100%" fill="url(#evm-dots)" />
                    </svg>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: 46, height: 46,
                      borderRadius: 13,
                      background: 'rgba(255,255,255,0.14)',
                      border: '1.5px solid rgba(255,255,255,0.22)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginBottom: 14,
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="3" />
                        <path d="m2 7 8.5 6a2.5 2.5 0 0 0 3 0L22 7" />
                      </svg>
                    </div>

                    <h2
                      id="evm-title"
                      style={{
                        margin: 0, fontSize: 18, fontWeight: 650, color: '#fff',
                        letterSpacing: '-0.3px', marginBottom: 4,
                      }}
                    >
                      Check your inbox
                    </h2>
                    <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>
                      We sent a 6-digit code to{' '}
                      <span style={{ color: '#fff', fontWeight: 600 }}>{maskedEmail}</span>
                    </p>

                    <div style={{
                      marginTop: 16, height: 3, borderRadius: 99,
                      background: 'rgba(255,255,255,0.15)', overflow: 'hidden',
                    }}>
                      <div
                        className="evm-progress"
                        style={{
                          height: '100%', borderRadius: 99,
                          width: `${progressPct}%`,
                          background: timerState === 'crit'
                            ? '#f87171'
                            : timerState === 'warn'
                            ? '#fbbf24'
                            : 'rgba(255,255,255,0.6)',
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* ── Body ── */}
                <div style={{ padding: '22px 24px 26px' }}>
                  <AnimatePresence mode="wait">

                    {isSuccess ? (
                      <motion.div
                        key="evm-success"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, paddingBlock: 8, textAlign: 'center' }}
                      >
                        <div style={{ position: 'relative', width: 64, height: 64 }}>
                          <div className="evm-ripple" style={{
                            position: 'absolute', inset: 0,
                            borderRadius: '50%', border: '2px solid #34d399',
                          }} />
                          <div className="evm-pop" style={{
                            width: 64, height: 64, borderRadius: '50%',
                            background: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                            border: '2px solid #6ee7b7',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                              <polyline className="evm-check" points="4 12 9 17 20 7" stroke="#059669" strokeWidth="2.5" fill="none" />
                            </svg>
                          </div>
                        </div>
                        <div>
                          <p style={{ margin: 0, fontSize: 15, fontWeight: 650, color: '#0f172a', letterSpacing: '-0.2px' }}>
                            Email verified!
                          </p>
                          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#94a3b8' }}>
                            Setting up your account…
                          </p>
                        </div>
                      </motion.div>

                    ) : (

                      <motion.div key="evm-form" initial={{ opacity: 1 }}>

                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          marginBottom: 14,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            Verification code
                          </span>
                          <span style={{
                            fontSize: 11.5, fontFamily: 'monospace', fontWeight: 600,
                            padding: '3px 10px', borderRadius: 99,
                            border: '1.5px solid',
                            ...(timerState === 'crit'
                              ? { background: '#fef2f2', color: '#dc2626', borderColor: '#fecaca' }
                              : timerState === 'warn'
                              ? { background: '#fffbeb', color: '#b45309', borderColor: '#fde68a' }
                              : { background: '#f8fafc', color: '#64748b', borderColor: '#e2e8f0' }),
                          }}>
                            {expiresSecs > 0 ? formatTime(expiresSecs) : 'Expired'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 14 }}>
                          {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                            <div
                              key={i}
                              style={{
                                width: 6, height: 6, borderRadius: '50%',
                                transition: 'background-color 0.25s, transform 0.25s',
                                transform: i < attempts ? 'scale(1.2)' : 'scale(1)',
                                background: i < attempts
                                  ? (attempts >= MAX_ATTEMPTS - 1 ? '#f59e0b' : '#f87171')
                                  : '#e2e8f0',
                              }}
                            />
                          ))}
                        </div>

                        <motion.div
                          animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
                          transition={{ duration: 0.42, ease: 'easeInOut' }}
                          style={{
                            display: 'flex',
                            gap: 8,
                            marginBottom: 10,
                            justifyContent: 'center',
                          }}
                          aria-label="6-digit verification code"
                        >
                          {digits.map((digit, i) => (
                            <input
                              key={i}
                              ref={el => { inputRefs.current[i] = el; }}
                              type="text"
                              inputMode="numeric"
                              maxLength={1}
                              value={digit}
                              onChange={e => handleChange(i, e.target.value)}
                              onKeyDown={e => handleKeyDown(i, e)}
                              onPaste={handlePaste}
                              onFocus={e => e.target.select()}
                              aria-label={`Digit ${i + 1}`}
                              className={`evm-digit${hasError ? ' evm-digit-error' : ''}`}
                              style={{
                                width: 48,
                                maxWidth: 52,
                                flexShrink: 0,
                                height: 54,
                                textAlign: 'center',
                                fontSize: 20,
                                fontWeight: 700,
                                fontFamily: '"SF Mono", "Fira Code", "Fira Mono", monospace',
                                caretColor: 'transparent',
                                userSelect: 'none',
                                outline: 'none',
                                borderRadius: 12,
                                borderWidth: 2,
                                borderStyle: 'solid',
                                ...(isSuccess
                                  ? { borderColor: '#34d399', background: '#f0fdf4', color: '#059669', transform: 'scale(1.04)' }
                                  : digit && hasError
                                  ? { borderColor: '#f87171', background: '#fef2f2', color: '#dc2626' }
                                  : digit
                                  ? { borderColor: '#6366f1', background: '#eef2ff', color: '#4338ca', transform: 'scale(1.04)' }
                                  : { borderColor: '#e2e8f0', background: '#fff', color: '#0f172a' }),
                              }}
                              {...(i === 0 ? { autoComplete: 'one-time-code' } : {})}
                            />
                          ))}
                        </motion.div>

                        <p style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          gap: 5, fontSize: 11.5, color: '#cbd5e1', marginBottom: 14,
                        }}>
                          <svg width="11" height="13" viewBox="0 0 13 15" fill="none" style={{ flexShrink: 0 }}>
                            <rect x="1" y="3" width="9" height="11" rx="1.5" stroke="#cbd5e1" strokeWidth="1.3" fill="none" />
                            <path d="M4 3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" stroke="#cbd5e1" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                          </svg>
                          Paste your code or type it in
                        </p>

                        <AnimatePresence>
                          {error && (
                            <motion.div
                              key="evm-error"
                              initial={{ opacity: 0, y: -6, height: 0 }}
                              animate={{ opacity: 1, y: 0, height: 'auto' }}
                              exit={{ opacity: 0, y: -4, height: 0 }}
                              transition={{ duration: 0.18 }}
                              style={{ overflow: 'hidden', marginBottom: 14 }}
                            >
                              <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: 8,
                                padding: '9px 12px',
                                background: '#fef2f2',
                                border: '1.5px solid #fecaca',
                                borderRadius: 10,
                              }}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: 1 }}>
                                  <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5" fill="none" />
                                  <path d="M8 5v4M8 11v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" />
                                </svg>
                                <p style={{ margin: 0, fontSize: 12, color: '#dc2626', lineHeight: 1.5 }} role="alert">
                                  {error}
                                </p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <button
                          type="button"
                          onClick={handleVerify}
                          disabled={isVerifying || digits.some(d => !d) || attempts >= MAX_ATTEMPTS}
                          aria-busy={isVerifying}
                          className="evm-btn-primary"
                          style={{
                            width: '100%',
                            height: 46,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            gap: 8,
                            borderRadius: 12,
                            border: 'none',
                            background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                            color: '#fff',
                            fontSize: 14,
                            fontWeight: 600,
                            letterSpacing: '-0.1px',
                            cursor: 'pointer',
                            marginBottom: 18,
                            opacity: (isVerifying || digits.some(d => !d) || attempts >= MAX_ATTEMPTS) ? 0.45 : 1,
                            transition: 'opacity 0.15s, transform 0.12s, filter 0.15s',
                          }}
                        >
                          {isVerifying ? (
                            <>
                              <svg className="evm-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" />
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                              </svg>
                              Verifying…
                            </>
                          ) : (
                            <>
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                <polyline points="9 12 11 14 15 10" />
                              </svg>
                              Verify email
                            </>
                          )}
                        </button>

                        <div style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          paddingTop: 14,
                          borderTop: '1.5px solid #f1f5f9',
                        }}>
                          <button
                            type="button"
                            onClick={onBack}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              fontSize: 12.5, color: '#94a3b8', background: 'none', border: 'none',
                              cursor: 'pointer', padding: '2px 0', fontWeight: 500,
                              transition: 'color 0.15s',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#475569')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 12H5M12 19l-7-7 7-7" />
                            </svg>
                            Back
                          </button>

                          <button
                            type="button"
                            onClick={handleResend}
                            disabled={cooldown > 0 || isResending}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 5,
                              fontSize: 12.5, fontWeight: 600, background: 'none', border: 'none',
                              cursor: cooldown > 0 || isResending ? 'not-allowed' : 'pointer',
                              padding: '2px 0',
                              color: cooldown > 0 || isResending ? '#cbd5e1' : '#6366f1',
                              transition: 'color 0.15s, opacity 0.15s',
                              opacity: cooldown > 0 || isResending ? 0.7 : 1,
                            }}
                            onMouseEnter={e => {
                              if (cooldown === 0 && !isResending) e.currentTarget.style.color = '#4338ca';
                            }}
                            onMouseLeave={e => {
                              if (cooldown === 0 && !isResending) e.currentTarget.style.color = '#6366f1';
                              else e.currentTarget.style.color = '#cbd5e1';
                            }}
                          >
                            <svg
                              width="13" height="13" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              style={{ ...(isResending ? { animation: 'evm-spin 0.9s linear infinite' } : {}) }}
                            >
                              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                              <path d="M21 3v5h-5" />
                              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                              <path d="M8 16H3v5" />
                            </svg>
                            {isResending
                              ? 'Sending…'
                              : cooldown > 0
                              ? `Resend in ${cooldown}s`
                              : 'Resend code'}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}