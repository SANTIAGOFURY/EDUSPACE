import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AppError } from '../../services/auth';

// ─── Service calls ─────────────────────────────────────────────────────────
// Wire these to your Firebase callable functions

import { httpsCallable } from 'firebase/functions';
import { fns as functions } from '../../services/firebase'; // your functions instance

const sendResetCodeFn   = httpsCallable<{ email: string },                           { success: boolean; expiresInMinutes: number }>(functions, 'sendResetCode');
const verifyResetCodeFn = httpsCallable<{ email: string; code: string },             { success: boolean; resetToken: string }>(functions, 'verifyResetCode');
const changePasswordFn  = httpsCallable<{ email: string; resetToken: string; newPassword: string }, { success: boolean }>(functions, 'changePassword');

// ─── Constants ──────────────────────────────────────────────────────────────

const CODE_LENGTH       = 6;
const RESEND_COOLDOWN_S = 60;
const MAX_ATTEMPTS      = 5;
const TOTAL_SECS        = 600;

// ─── Password strength (mirrors RegisterForm) ───────────────────────────────

interface PwCheck { label: string; pass: boolean }

function getPwStrength(pw: string): { score: number; checks: PwCheck[] } {
  const checks: PwCheck[] = [
    { label: '8+ characters',     pass: pw.length >= 8 },
    { label: 'Uppercase letter',  pass: /[A-Z]/.test(pw) },
    { label: 'Number',            pass: /[0-9]/.test(pw) },
    { label: 'Special character', pass: /[^A-Za-z0-9]/.test(pw) },
  ];
  return { score: checks.filter(c => c.pass).length, checks };
}

const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['', '#f87171', '#fbbf24', '#fbbf24', '#34d399'];

// ─── Props ───────────────────────────────────────────────────────────────────

interface ForgotPasswordModalProps {
  isOpen:  boolean;
  onClose: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ForgotPasswordModal({ isOpen, onClose }: ForgotPasswordModalProps) {

  // ── Steps ──
  type Step = 'email' | 'code' | 'password' | 'done';
  const [step, setStep] = useState<Step>('email');

  // ── Email step ──
  const [email,        setEmail]        = useState('');
  const [emailError,   setEmailError]   = useState('');
  const [isSending,    setIsSending]    = useState(false);
  const [codeSentAt,   setCodeSentAt]   = useState<Date | null>(null);

  // ── Code step ──
  const [digits,       setDigits]       = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [codeError,    setCodeError]    = useState('');
  const [isVerifying,  setIsVerifying]  = useState(false);
  const [isResending,  setIsResending]  = useState(false);
  const [shake,        setShake]        = useState(false);
  const [cooldown,     setCooldown]     = useState(RESEND_COOLDOWN_S);
  const [expiresSecs,  setExpiresSecs]  = useState(TOTAL_SECS);
  const [attempts,     setAttempts]     = useState(0);
  const [resetToken,   setResetToken]   = useState('');
  const inputRefs       = useRef<Array<HTMLInputElement | null>>(Array(CODE_LENGTH).fill(null));
  const autoVerifyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Password step ──
  const [newPassword,  setNewPassword]  = useState('');
  const [confirmPw,    setConfirmPw]    = useState('');
  const [showPw,       setShowPw]       = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [showChecks,   setShowChecks]   = useState(false);
  const [pwError,      setPwError]      = useState('');
  const [isSaving,     setIsSaving]     = useState(false);
  const { score, checks } = getPwStrength(newPassword);

  // ── Reset all state when modal opens/closes ──────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      // Delay clear so exit animation finishes
      const t = setTimeout(() => {
        setStep('email');
        setEmail(''); setEmailError(''); setIsSending(false); setCodeSentAt(null);
        setDigits(Array(CODE_LENGTH).fill('')); setCodeError(''); setIsVerifying(false);
        setIsResending(false); setCooldown(RESEND_COOLDOWN_S); setExpiresSecs(TOTAL_SECS);
        setAttempts(0); setResetToken('');
        setNewPassword(''); setConfirmPw(''); setShowPw(false); setShowConfirm(false);
        setShowChecks(false); setPwError(''); setIsSaving(false);
      }, 350);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Timers for code step ──────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'code') return;
    setCooldown(RESEND_COOLDOWN_S);
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [step, codeSentAt]);

  useEffect(() => {
    if (step !== 'code') return;
    setExpiresSecs(TOTAL_SECS);
    const id = setInterval(() => setExpiresSecs(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [step, codeSentAt]);

  // Focus first digit when code step mounts
  useEffect(() => {
    if (step === 'code') {
      setTimeout(() => inputRefs.current[0]?.focus(), 180);
    }
  }, [step]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) =>
    a + b.replace(/./g, '•') + c);

  const progressPct = (expiresSecs / TOTAL_SECS) * 100;
  const timerState  = expiresSecs <= 60 ? 'crit' : expiresSecs <= 180 ? 'warn' : 'ok';

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  function resolveError(err: unknown): string {
    if (err instanceof AppError) return err.i18nKey;
    if (err instanceof Error)    return err.message;
    return 'Something went wrong. Please try again.';
  }

  // ── Step 1: Send reset code ───────────────────────────────────────────────

  const handleSendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setEmailError('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) { setEmailError('Please enter a valid email address.'); return; }

    setEmailError('');
    setIsSending(true);
    try {
      await sendResetCodeFn({ email: trimmed });
      setEmail(trimmed);
      setCodeSentAt(new Date());
      setDigits(Array(CODE_LENGTH).fill(''));
      setCodeError('');
      setAttempts(0);
      setStep('code');
    } catch (err) {
      setEmailError(resolveError(err));
    } finally {
      setIsSending(false);
    }
  };

  // ── Step 2: Verify code ───────────────────────────────────────────────────

  const handleVerifyCode = useCallback(async (code: string) => {
    if (isVerifying) return;
    setIsVerifying(true);
    setCodeError('');
    try {
      const res = await verifyResetCodeFn({ email, code });
      setResetToken(res.data.resetToken);
      setStep('password');
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      const remaining = MAX_ATTEMPTS - newAttempts;
      const base = resolveError(err);
      setCodeError(
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
  }, [email, attempts, isVerifying]);

  const handleVerify = useCallback(() => {
    const code = digits.join('');
    if (code.length < CODE_LENGTH) { setCodeError('Please enter all 6 digits.'); triggerShake(); return; }
    handleVerifyCode(code);
  }, [digits, handleVerifyCode]);

  // Auto-submit when all digits filled
  useEffect(() => {
    if (step !== 'code') return;
    if (digits.every(d => d !== '') && !isVerifying) {
      if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current);
      autoVerifyTimer.current = setTimeout(handleVerify, 140);
    }
    return () => { if (autoVerifyTimer.current) clearTimeout(autoVerifyTimer.current); };
  }, [digits, isVerifying, step, handleVerify]);

  // ── Code input handlers ───────────────────────────────────────────────────

  const handleChange = useCallback((index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    if (!char) return;
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    setCodeError('');
    if (index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }, [digits]);

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) { next[index] = ''; setDigits(next); }
      else if (index > 0) { next[index - 1] = ''; setDigits(next); inputRefs.current[index - 1]?.focus(); }
      setCodeError('');
      return;
    }
    if (/^\d$/.test(e.key) && digits[index]) {
      const next = [...digits];
      next[index] = e.key;
      setDigits(next);
      setCodeError('');
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
    setCodeError('');
    inputRefs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
    if (pasted.length === CODE_LENGTH) setTimeout(() => handleVerifyCode(next.join('')), 140);
  }, [handleVerifyCode]);

  // ── Resend ────────────────────────────────────────────────────────────────

  const handleResend = async () => {
    if (cooldown > 0 || isResending) return;
    setIsResending(true);
    setCodeError('');
    try {
      await sendResetCodeFn({ email });
      setCodeSentAt(new Date());
      setCooldown(RESEND_COOLDOWN_S);
      setExpiresSecs(TOTAL_SECS);
      setAttempts(0);
      setDigits(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 60);
    } catch (err) {
      setCodeError(resolveError(err));
    } finally {
      setIsResending(false);
    }
  };

  // ── Step 3: Change password ───────────────────────────────────────────────

  const handleChangePassword = async () => {
    setPwError('');
    if (score < 3) {
      setPwError('Your password is too weak. Add uppercase letters, numbers, or special characters.');
      return;
    }
    if (newPassword !== confirmPw) {
      setPwError('Passwords do not match.');
      return;
    }
    setIsSaving(true);
    try {
      await changePasswordFn({ email, resetToken, newPassword });
      setStep('done');
    } catch (err) {
      setPwError(resolveError(err));
    } finally {
      setIsSaving(false);
    }
  };

  // ── Shared header config per step ─────────────────────────────────────────

  const headerConfig = {
    email: {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
        </svg>
      ),
      title: 'Reset your password',
      subtitle: "Enter your email and we'll send you a 6-digit code.",
    },
    code: {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="3" />
          <path d="m2 7 8.5 6a2.5 2.5 0 0 0 3 0L22 7" />
        </svg>
      ),
      title: 'Check your inbox',
      subtitle: (
        <>We sent a 6-digit code to{' '}
          <span style={{ color: '#fff', fontWeight: 600 }}>{maskedEmail}</span>
        </>
      ),
    },
    password: {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      ),
      title: 'Set a new password',
      subtitle: 'Choose something strong you haven\'t used before.',
    },
    done: {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      ),
      title: 'Password updated',
      subtitle: 'Your password has been changed. You can now sign in.',
    },
  };

  const cfg = headerConfig[step];

  // ── Step indicator dots ───────────────────────────────────────────────────

  const STEPS: Step[] = ['email', 'code', 'password', 'done'];
  const stepIdx = STEPS.indexOf(step);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes rpm-spin   { to { transform: rotate(360deg); } }
        @keyframes rpm-pop    { 0%{transform:scale(0.6);opacity:0} 70%{transform:scale(1.1)} 100%{transform:scale(1);opacity:1} }
        @keyframes rpm-ripple { 0%{transform:scale(0.8);opacity:0.6} 100%{transform:scale(2.4);opacity:0} }
        @keyframes rpm-dash   { to { stroke-dashoffset: 0; } }
        @keyframes rpm-fadein { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

        .rpm-spin   { animation: rpm-spin 0.9s linear infinite; }
        .rpm-pop    { animation: rpm-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards; }
        .rpm-ripple { animation: rpm-ripple 1.4s ease-out infinite; }
        .rpm-check  { stroke-dasharray: 28; stroke-dashoffset: 28; animation: rpm-dash 0.45s 0.2s ease forwards; }
        .rpm-fadein { animation: rpm-fadein 0.22s ease forwards; }

        .rpm-digit { transition: border-color 0.14s ease, background 0.14s ease, transform 0.14s ease; }
        .rpm-digit:focus { box-shadow: 0 0 0 3px rgba(99,102,241,0.15); outline: none; }
        .rpm-digit-error:focus { box-shadow: 0 0 0 3px rgba(239,68,68,0.12); }

        .rpm-input {
          width: 100%;
          padding: 10px 40px 10px 38px;
          font-size: 13.5px;
          border-radius: 10px;
          border: 1.5px solid #e2e8f0;
          background: #fff;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          font-family: inherit;
        }
        .rpm-input::placeholder { color: #94a3b8; }
        .rpm-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
        .rpm-input-error { border-color: #f87171 !important; }
        .rpm-input-error:focus { box-shadow: 0 0 0 3px rgba(248,113,113,0.12) !important; }

        .rpm-btn {
          position: relative; overflow: hidden;
          width: 100%; height: 46px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          border-radius: 12px; border: none;
          background: linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%);
          color: #fff; font-size: 14px; font-weight: 600;
          letter-spacing: -0.1px; cursor: pointer; font-family: inherit;
          transition: opacity 0.15s, transform 0.12s, filter 0.15s;
        }
        .rpm-btn::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(to bottom, rgba(255,255,255,0.08), transparent);
          pointer-events: none;
        }
        .rpm-btn:not(:disabled):hover  { filter: brightness(1.08); }
        .rpm-btn:not(:disabled):active { transform: scale(0.985); }
        .rpm-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .rpm-progress { transition: width 1s linear, background-color 0.5s ease; }
      `}</style>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="rpm-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(15,15,30,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
              aria-hidden="true"
              onClick={onClose}
            />

            {/* Dialog */}
            <motion.div
              key="rpm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="rpm-title"
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.94, y: 18 }}
              animate={{ opacity: 1, scale: 1,    y: 0  }}
              exit={{ opacity: 0, scale: 0.96,    y: 12 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div
                style={{
                  width: '100%', maxWidth: 420,
                  borderRadius: 24, overflow: 'hidden',
                  background: '#fff',
                  boxShadow: '0 24px 64px rgba(15,15,30,0.18), 0 4px 16px rgba(15,15,30,0.08)',
                }}
                onClick={e => e.stopPropagation()}
              >

                {/* ── Header ──────────────────────────────────────────────── */}
                <div style={{
                  background: 'linear-gradient(135deg, #4f46e5 0%, #6d28d9 100%)',
                  padding: '24px 24px 20px',
                  position: 'relative', overflow: 'hidden',
                }}>
                  {/* Decoration */}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                    <div style={{ position:'absolute', top:-40, right:-40, width:160, height:160, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,0.08)' }} />
                    <div style={{ position:'absolute', top:-12, right:-12, width:88,  height:88,  borderRadius:'50%', border:'1.5px solid rgba(255,255,255,0.10)' }} />
                    <div style={{ position:'absolute', bottom:-32, left:-20, width:110, height:110, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,0.06)' }} />
                    <svg width="100%" height="100%" style={{ position:'absolute', inset:0, opacity:0.06 }}>
                      <pattern id="rpm-dots" x="0" y="0" width="18" height="18" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1.2" fill="white" />
                      </pattern>
                      <rect width="100%" height="100%" fill="url(#rpm-dots)" />
                    </svg>
                  </div>

                  <div style={{ position: 'relative' }}>
                    {/* Icon */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`icon-${step}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          width:46, height:46, borderRadius:13,
                          background:'rgba(255,255,255,0.14)',
                          border:'1.5px solid rgba(255,255,255,0.22)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          marginBottom:14,
                        }}
                      >
                        {cfg.icon}
                      </motion.div>
                    </AnimatePresence>

                    {/* Title */}
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`title-${step}`}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                      >
                        <h2
                          id="rpm-title"
                          style={{ margin:0, fontSize:18, fontWeight:650, color:'#fff', letterSpacing:'-0.3px', marginBottom:4 }}
                        >
                          {cfg.title}
                        </h2>
                        <p style={{ margin:0, fontSize:13, color:'rgba(255,255,255,0.65)', lineHeight:1.5 }}>
                          {cfg.subtitle}
                        </p>
                      </motion.div>
                    </AnimatePresence>

                    {/* Progress bar (code step only) */}
                    {step === 'code' && (
                      <div style={{ marginTop:16, height:3, borderRadius:99, background:'rgba(255,255,255,0.15)', overflow:'hidden' }}>
                        <div
                          className="rpm-progress"
                          style={{
                            height:'100%', borderRadius:99,
                            width:`${progressPct}%`,
                            background: timerState === 'crit' ? '#f87171' : timerState === 'warn' ? '#fbbf24' : 'rgba(255,255,255,0.6)',
                          }}
                        />
                      </div>
                    )}

                    {/* Step indicator dots */}
                    <div style={{ display:'flex', gap:5, marginTop: step === 'code' ? 12 : 14 }}>
                      {STEPS.filter(s => s !== 'done').map((s, i) => (
                        <div
                          key={s}
                          style={{
                            height: 3, flex: 1, borderRadius: 99,
                            transition: 'background 0.3s',
                            background: i <= stepIdx - (step === 'done' ? 0 : 0)
                              ? 'rgba(255,255,255,0.85)'
                              : 'rgba(255,255,255,0.25)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Body ────────────────────────────────────────────────── */}
                <div style={{ padding: '22px 24px 26px' }}>
                  <AnimatePresence mode="wait">

                    {/* ── STEP 1: Email ── */}
                    {step === 'email' && (
                      <motion.div
                        key="rpm-email"
                        initial={{ opacity: 0, x: -16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.22 }}
                      >
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:6 }}>
                            Email address
                          </label>
                          <div style={{ position: 'relative' }}>
                            {/* Mail icon */}
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                              style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                              <rect x="2" y="4" width="20" height="16" rx="3"/>
                              <path d="m2 7 8.5 6a2.5 2.5 0 0 0 3 0L22 7"/>
                            </svg>
                            <input
                              type="email"
                              value={email}
                              onChange={e => { setEmail(e.target.value); setEmailError(''); }}
                              onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                              placeholder="you@example.com"
                              autoFocus
                              autoComplete="email"
                              className={`rpm-input${emailError ? ' rpm-input-error' : ''}`}
                              aria-invalid={!!emailError}
                            />
                          </div>

                          <AnimatePresence>
                            {emailError && (
                              <motion.div
                                key="email-err"
                                initial={{ opacity:0, y:-4, height:0 }}
                                animate={{ opacity:1, y:0, height:'auto' }}
                                exit={{ opacity:0, y:-4, height:0 }}
                                transition={{ duration:0.18 }}
                                style={{ overflow:'hidden', marginTop:8 }}
                              >
                                <div style={{ display:'flex', alignItems:'flex-start', gap:7, padding:'8px 10px', background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:9 }}>
                                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                                    <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5" fill="none"/>
                                    <path d="M8 5v4M8 11v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
                                  </svg>
                                  <p style={{ margin:0, fontSize:11.5, color:'#dc2626', lineHeight:1.5 }} role="alert">{emailError}</p>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        <button className="rpm-btn" onClick={handleSendCode} disabled={isSending} aria-busy={isSending}>
                          {isSending ? (
                            <>
                              <svg className="rpm-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                              </svg>
                              Sending code…
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                              </svg>
                              Send reset code
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={onClose}
                          style={{
                            display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                            width:'100%', marginTop:12, fontSize:12.5, fontWeight:500,
                            color:'#94a3b8', background:'none', border:'none', cursor:'pointer', padding:'4px 0',
                            transition:'color 0.15s', fontFamily:'inherit',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.color = '#475569')}
                          onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                        >
                          Cancel
                        </button>
                      </motion.div>
                    )}

                    {/* ── STEP 2: Code ── */}
                    {step === 'code' && (
                      <motion.div
                        key="rpm-code"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.22 }}
                      >
                        {/* Timer + label */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
                          <span style={{ fontSize:11, fontWeight:600, color:'#94a3b8', letterSpacing:'0.08em', textTransform:'uppercase' }}>
                            Reset code
                          </span>
                          <span style={{
                            fontSize:11.5, fontFamily:'monospace', fontWeight:600,
                            padding:'3px 10px', borderRadius:99, border:'1.5px solid',
                            ...(timerState === 'crit'
                              ? { background:'#fef2f2', color:'#dc2626', borderColor:'#fecaca' }
                              : timerState === 'warn'
                              ? { background:'#fffbeb', color:'#b45309', borderColor:'#fde68a' }
                              : { background:'#f8fafc', color:'#64748b', borderColor:'#e2e8f0' }),
                          }}>
                            {expiresSecs > 0 ? formatTime(expiresSecs) : 'Expired'}
                          </span>
                        </div>

                        {/* Attempt dots */}
                        <div style={{ display:'flex', gap:5, justifyContent:'center', marginBottom:12 }}>
                          {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                            <div key={i} style={{
                              width:6, height:6, borderRadius:'50%',
                              transition:'background-color 0.25s, transform 0.25s',
                              transform: i < attempts ? 'scale(1.2)' : 'scale(1)',
                              background: i < attempts
                                ? (attempts >= MAX_ATTEMPTS - 1 ? '#f59e0b' : '#f87171')
                                : '#e2e8f0',
                            }} />
                          ))}
                        </div>

                        {/* OTP inputs */}
                        <motion.div
                          animate={shake ? { x: [-8, 8, -6, 6, -3, 3, 0] } : {}}
                          transition={{ duration: 0.42, ease: 'easeInOut' }}
                          style={{ display:'flex', gap:8, marginBottom:8, justifyContent:'center' }}
                          aria-label="6-digit reset code"
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
                              className={`rpm-digit${codeError ? ' rpm-digit-error' : ''}`}
                              style={{
                                width:48, maxWidth:52, flexShrink:0, height:54,
                                textAlign:'center', fontSize:20, fontWeight:700,
                                fontFamily:'"SF Mono","Fira Code","Fira Mono",monospace',
                                caretColor:'transparent', userSelect:'none',
                                outline:'none', borderRadius:12,
                                borderWidth:2, borderStyle:'solid',
                                transition:'all 0.14s ease',
                                ...(digit && codeError
                                  ? { borderColor:'#f87171', background:'#fef2f2', color:'#dc2626' }
                                  : digit
                                  ? { borderColor:'#6366f1', background:'#eef2ff', color:'#4338ca', transform:'scale(1.04)' }
                                  : { borderColor:'#e2e8f0', background:'#fff', color:'#0f172a' }),
                              }}
                              {...(i === 0 ? { autoComplete: 'one-time-code' } : {})}
                            />
                          ))}
                        </motion.div>

                        {/* Paste hint */}
                        <p style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:5, fontSize:11.5, color:'#cbd5e1', marginBottom:12 }}>
                          <svg width="11" height="13" viewBox="0 0 13 15" fill="none" style={{ flexShrink:0 }}>
                            <rect x="1" y="3" width="9" height="11" rx="1.5" stroke="#cbd5e1" strokeWidth="1.3" fill="none"/>
                            <path d="M4 3V2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" stroke="#cbd5e1" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                          </svg>
                          Paste your code or type it in
                        </p>

                        {/* Code error */}
                        <AnimatePresence>
                          {codeError && (
                            <motion.div
                              key="code-err"
                              initial={{ opacity:0, y:-6, height:0 }}
                              animate={{ opacity:1, y:0, height:'auto' }}
                              exit={{ opacity:0, y:-4, height:0 }}
                              transition={{ duration:0.18 }}
                              style={{ overflow:'hidden', marginBottom:12 }}
                            >
                              <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'9px 12px', background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:10 }}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                                  <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5" fill="none"/>
                                  <path d="M8 5v4M8 11v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                                <p style={{ margin:0, fontSize:12, color:'#dc2626', lineHeight:1.5 }} role="alert">{codeError}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Verify button */}
                        <button
                          className="rpm-btn"
                          onClick={handleVerify}
                          disabled={isVerifying || digits.some(d => !d) || attempts >= MAX_ATTEMPTS}
                          aria-busy={isVerifying}
                          style={{ marginBottom:16 }}
                        >
                          {isVerifying ? (
                            <>
                              <svg className="rpm-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                              </svg>
                              Verifying…
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                                <polyline points="9 12 11 14 15 10"/>
                              </svg>
                              Verify code
                            </>
                          )}
                        </button>

                        {/* Footer */}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingTop:14, borderTop:'1.5px solid #f1f5f9' }}>
                          <button
                            type="button"
                            onClick={() => setStep('email')}
                            style={{ display:'flex', alignItems:'center', gap:5, fontSize:12.5, fontWeight:500, color:'#94a3b8', background:'none', border:'none', cursor:'pointer', padding:'2px 0', transition:'color 0.15s', fontFamily:'inherit' }}
                            onMouseEnter={e => (e.currentTarget.style.color = '#475569')}
                            onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M19 12H5M12 19l-7-7 7-7"/>
                            </svg>
                            Back
                          </button>

                          <button
                            type="button"
                            onClick={handleResend}
                            disabled={cooldown > 0 || isResending}
                            style={{
                              display:'flex', alignItems:'center', gap:5,
                              fontSize:12.5, fontWeight:600, background:'none', border:'none',
                              cursor: cooldown > 0 || isResending ? 'not-allowed' : 'pointer',
                              padding:'2px 0', fontFamily:'inherit',
                              color: cooldown > 0 || isResending ? '#cbd5e1' : '#6366f1',
                              opacity: cooldown > 0 || isResending ? 0.7 : 1,
                              transition:'color 0.15s, opacity 0.15s',
                            }}
                            onMouseEnter={e => { if (cooldown === 0 && !isResending) e.currentTarget.style.color = '#4338ca'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = cooldown > 0 || isResending ? '#cbd5e1' : '#6366f1'; }}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              style={{ ...(isResending ? { animation:'rpm-spin 0.9s linear infinite' } : {}) }}>
                              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
                              <path d="M21 3v5h-5"/>
                              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
                              <path d="M8 16H3v5"/>
                            </svg>
                            {isResending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* ── STEP 3: New password ── */}
                    {step === 'password' && (
                      <motion.div
                        key="rpm-password"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 16 }}
                        transition={{ duration: 0.22 }}
                      >
                        {/* New password */}
                        <div style={{ marginBottom: 12 }}>
                          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:6 }}>
                            New password
                          </label>
                          <div style={{ position:'relative' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                              style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                              <rect x="3" y="11" width="18" height="11" rx="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <input
                              type={showPw ? 'text' : 'password'}
                              value={newPassword}
                              onChange={e => { setNewPassword(e.target.value); setShowChecks(true); setPwError(''); }}
                              onFocus={() => setShowChecks(true)}
                              placeholder="••••••••"
                              autoFocus
                              autoComplete="new-password"
                              className={`rpm-input${pwError ? ' rpm-input-error' : ''}`}
                              style={{ paddingRight: 40 }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowPw(v => !v)}
                              style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:2 }}
                              aria-label={showPw ? 'Hide password' : 'Show password'}
                            >
                              {showPw ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                  <line x1="1" y1="1" x2="23" y2="23"/>
                                </svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                  <circle cx="12" cy="12" r="3"/>
                                </svg>
                              )}
                            </button>
                          </div>

                          {/* Strength meter */}
                          <AnimatePresence>
                            {showChecks && newPassword.length > 0 && (
                              <motion.div
                                initial={{ opacity:0, height:0 }}
                                animate={{ opacity:1, height:'auto' }}
                                exit={{ opacity:0, height:0 }}
                                transition={{ duration:0.2 }}
                                style={{ overflow:'hidden', marginTop:8 }}
                              >
                                {/* Bars */}
                                <div style={{ display:'flex', gap:4, alignItems:'center', marginBottom:6 }}>
                                  {[1,2,3,4].map(i => (
                                    <div key={i} style={{
                                      flex:1, height:3, borderRadius:99,
                                      transition:'background 0.3s',
                                      background: i <= score ? STRENGTH_COLOR[score] : '#e2e8f0',
                                    }} />
                                  ))}
                                  <span style={{ fontSize:11, fontWeight:600, marginLeft:4, color: STRENGTH_COLOR[score] || '#94a3b8', minWidth:32 }}>
                                    {STRENGTH_LABEL[score]}
                                  </span>
                                </div>
                                {/* Checks */}
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 12px' }}>
                                  {checks.map(c => (
                                    <div key={c.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
                                      {c.pass ? (
                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                          <circle cx="8" cy="8" r="7" fill="#34d399" fillOpacity="0.2"/>
                                          <polyline points="4.5 8 7 10.5 11.5 5.5" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                        </svg>
                                      ) : (
                                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                                          <circle cx="8" cy="8" r="7" fill="#e2e8f0"/>
                                        </svg>
                                      )}
                                      <span style={{ fontSize:11, color: c.pass ? '#475569' : '#94a3b8' }}>{c.label}</span>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Confirm password */}
                        <div style={{ marginBottom: 14 }}>
                          <label style={{ display:'block', fontSize:12, fontWeight:600, color:'#475569', marginBottom:6 }}>
                            Confirm password
                          </label>
                          <div style={{ position:'relative' }}>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                              style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}>
                              <rect x="3" y="11" width="18" height="11" rx="2"/>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                            </svg>
                            <input
                              type={showConfirm ? 'text' : 'password'}
                              value={confirmPw}
                              onChange={e => { setConfirmPw(e.target.value); setPwError(''); }}
                              onKeyDown={e => e.key === 'Enter' && handleChangePassword()}
                              placeholder="••••••••"
                              autoComplete="new-password"
                              className={`rpm-input${pwError ? ' rpm-input-error' : ''}`}
                              style={{ paddingRight: 40 }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirm(v => !v)}
                              style={{ position:'absolute', right:11, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:2 }}
                              aria-label={showConfirm ? 'Hide password' : 'Show password'}
                            >
                              {showConfirm ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                                  <line x1="1" y1="1" x2="23" y2="23"/>
                                </svg>
                              ) : (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                  <circle cx="12" cy="12" r="3"/>
                                </svg>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Password error */}
                        <AnimatePresence>
                          {pwError && (
                            <motion.div
                              key="pw-err"
                              initial={{ opacity:0, y:-6, height:0 }}
                              animate={{ opacity:1, y:0, height:'auto' }}
                              exit={{ opacity:0, y:-4, height:0 }}
                              transition={{ duration:0.18 }}
                              style={{ overflow:'hidden', marginBottom:12 }}
                            >
                              <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'9px 12px', background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:10 }}>
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink:0, marginTop:1 }}>
                                  <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5" fill="none"/>
                                  <path d="M8 5v4M8 11v.5" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                                <p style={{ margin:0, fontSize:12, color:'#dc2626', lineHeight:1.5 }} role="alert">{pwError}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <button className="rpm-btn" onClick={handleChangePassword} disabled={isSaving} aria-busy={isSaving}>
                          {isSaving ? (
                            <>
                              <svg className="rpm-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5"/>
                                <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                              </svg>
                              Saving…
                            </>
                          ) : (
                            <>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                                <polyline points="17 21 17 13 7 13 7 21"/>
                                <polyline points="7 3 7 8 15 8"/>
                              </svg>
                              Save new password
                            </>
                          )}
                        </button>
                      </motion.div>
                    )}

                    {/* ── STEP 4: Done ── */}
                    {step === 'done' && (
                      <motion.div
                        key="rpm-done"
                        initial={{ opacity: 0, scale: 0.92 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, paddingBlock:8, textAlign:'center' }}
                      >
                        {/* Animated check circle */}
                        <div style={{ position:'relative', width:64, height:64 }}>
                          <div className="rpm-ripple" style={{ position:'absolute', inset:0, borderRadius:'50%', border:'2px solid #34d399' }} />
                          <div className="rpm-pop" style={{
                            width:64, height:64, borderRadius:'50%',
                            background:'linear-gradient(135deg, #d1fae5, #a7f3d0)',
                            border:'2px solid #6ee7b7',
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                              <polyline className="rpm-check" points="4 12 9 17 20 7" stroke="#059669" strokeWidth="2.5" fill="none"/>
                            </svg>
                          </div>
                        </div>

                        <div>
                          <p style={{ margin:0, fontSize:15, fontWeight:650, color:'#0f172a', letterSpacing:'-0.2px' }}>
                            Password updated!
                          </p>
                          <p style={{ margin:'4px 0 0', fontSize:12.5, color:'#94a3b8', lineHeight:1.5 }}>
                            All previous sessions have been signed out for your security.
                          </p>
                        </div>

                        <button
                          className="rpm-btn"
                          onClick={onClose}
                          style={{ width:'100%', marginTop:4 }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                            <polyline points="10 17 15 12 10 7"/>
                            <line x1="15" y1="12" x2="3" y2="12"/>
                          </svg>
                          Sign in now
                        </button>
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