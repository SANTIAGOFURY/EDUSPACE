import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, Mail, Lock, User, GraduationCap, BookOpen,
  CheckCircle2, XCircle, ArrowRight, Loader2, AlertCircle,
} from 'lucide-react';
import {
  signUpWithEmail,
  validateSignupEmail,
  checkAuthorizedUser,
  sendVerificationCode,
  AppError,
} from '../../services/auth';
import { EmailVerificationModal } from './EmailVerificationModal';

// ─── Password strength ────────────────────────────────────────────────────────

interface Check { label: string; labelFr: string; pass: boolean }

function getStrength(password: string): { score: number; checks: Check[] } {
  const checks: Check[] = [
    { label: '8+ characters',     labelFr: '8+ caractères',     pass: password.length >= 8 },
    { label: 'Uppercase letter',  labelFr: 'Majuscule',         pass: /[A-Z]/.test(password) },
    { label: 'Number',            labelFr: 'Chiffre',           pass: /[0-9]/.test(password) },
    { label: 'Special character', labelFr: 'Caractère spécial', pass: /[^A-Za-z0-9]/.test(password) },
  ];
  return { score: checks.filter((c) => c.pass).length, checks };
}

const STRENGTH_COLORS = [
  'bg-error-500',
  'bg-error-500',
  'bg-warning-500',
  'bg-warning-500',
  'bg-success-500',
];
const STRENGTH_LABELS    = ['', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_LABELS_FR = ['', 'Faible', 'Passable', 'Bon', 'Fort'];

const ROLES = [
  { value: 'student', icon: GraduationCap, label: 'Student', labelFr: 'Étudiant' },
  { value: 'teacher', icon: BookOpen,      label: 'Teacher', labelFr: 'Enseignant' },
] as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().min(1, 'errors.emailRequired').email('errors.emailInvalid'),
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');

  // ── Steps ──
  type Step = 'email-check' | 'register';
  const [step, setStep]                   = useState<Step>('email-check');
  const [verifiedEmail, setVerifiedEmail] = useState('');

  // ── Email gate state ──
  const [isChecking, setIsChecking]       = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [gateError, setGateError]         = useState('');

  // ── Verification modal state ──
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [codeSentAt, setCodeSentAt]           = useState<Date | null>(null);
  const [codeExpiresIn, setCodeExpiresIn]     = useState<number | undefined>(undefined);

  // ── Register form state ──
  const [formError, setFormError]         = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [passwordValue, setPasswordValue] = useState('');
  const [showChecks, setShowChecks]       = useState(false);
  const { score, checks } = getStrength(passwordValue);

  // ── Email gate form ──
  const {
    register: regEmail,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors },
  } = useForm<{ email: string }>({ resolver: zodResolver(emailSchema) });

  // ── Register schema ──
  const registerSchema = z.object({
    firstName:       z.string().min(2, t('errors.firstNameRequired')),
    lastName:        z.string().min(2, t('errors.lastNameRequired')),
    role:            z.enum(['student', 'teacher']),
    password:        z.string().min(8, t('errors.passwordMinLength')),
    confirmPassword: z.string().min(1, t('errors.passwordRequired')),
  }).refine((d) => d.password === d.confirmPassword, {
    message: t('errors.passwordMismatch'),
    path:    ['confirmPassword'],
  });

  type RegisterData = z.infer<typeof registerSchema>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterData>({
    resolver:      zodResolver(registerSchema),
    defaultValues: { role: 'student' },
  });

  const selectedRole = watch('role');

  // ── Error resolver ────────────────────────────────────────────────────────

  function resolveError(err: unknown): string {
    if (err instanceof AppError) return t(err.i18nKey);
    return t('errors.genericError');
  }

  // ── Step 1: check authorized email + open verification modal ─────────────

  const onEmailCheck = async ({ email }: { email: string }) => {
    setGateError('');
    setIsChecking(true);
    try {
      const normalized = email.trim().toLowerCase();
      await checkAuthorizedUser(normalized);
      setVerifiedEmail(normalized);

      setIsSendingCode(true);
      const { expiresInMinutes } = await sendVerificationCode(normalized);
      setCodeSentAt(new Date());
      setCodeExpiresIn(expiresInMinutes);
      setShowVerifyModal(true);
    } catch (err) {
      setGateError(resolveError(err));
    } finally {
      setIsChecking(false);
      setIsSendingCode(false);
    }
  };

  // ── Verification modal callbacks ──────────────────────────────────────────

  const handleVerified = () => {
    setShowVerifyModal(false);
    setStep('register');
  };

  const handleVerifyBack = () => {
    setShowVerifyModal(false);
  };

  // ── Step 2: register ──────────────────────────────────────────────────────

  const onSubmit = async (data: RegisterData) => {
    setFormError('');

    if (score < 3) {
      setFormError(
        isFr
          ? 'Votre mot de passe est trop faible. Ajoutez des majuscules, chiffres ou caractères spéciaux.'
          : 'Your password is too weak. Add uppercase letters, numbers, or special characters.',
      );
      return;
    }

    try {
      await validateSignupEmail(verifiedEmail);
    } catch (err) {
      setFormError(resolveError(err));
      return;
    }

    try {
      await signUpWithEmail(
        verifiedEmail,
        data.password,
        data.firstName,
        data.lastName,
        data.role,
      );
      toast.success(t('success.signUp'));
      onSuccess();
    } catch (err) {
      setFormError(resolveError(err));
    }
  };

  // ── Input class helper ────────────────────────────────────────────────────

  const inputCls = useCallback(
    (hasError: boolean) =>
      `w-full py-2.5 text-sm rounded-[var(--radius-md)] border bg-white transition-all duration-150
       placeholder:text-surface-300 text-surface-900
       focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
       ${hasError ? 'border-error-400' : 'border-surface-200 hover:border-surface-300'}`,
    [],
  );

  // ── Verified email badge ──────────────────────────────────────────────────

  const VerifiedEmailBadge = ({ onBack }: { onBack: () => void }) => (
    <div className="flex items-center justify-between mb-4 px-3 py-2
                    rounded-[var(--radius-md)] bg-success-50 border border-success-200">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={14} className="text-success-500" aria-hidden="true" />
        <span className="text-xs text-success-700 font-medium">{verifiedEmail}</span>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-surface-500 hover:text-surface-700 underline cursor-pointer"
      >
        {isFr ? 'Changer' : 'Change'}
      </button>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
        className="w-full"
      >
        {/* Header */}
        <div className="mb-6">
          <h1
            className="text-2xl font-semibold text-surface-900 tracking-tight mb-1"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t('auth.createAccount')}
          </h1>
          <p className="text-sm text-surface-500">{t('auth.createAccountSubtitle')}</p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── STEP 1: Email gate ── */}
          {step === 'email-check' && (
            <motion.div
              key="email-gate"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.22 }}
            >
              <form onSubmit={handleEmailSubmit(onEmailCheck)} noValidate className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    {t('auth.email')}
                  </label>
                  <div className="relative">
                    <Mail
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      {...regEmail('email')}
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder="you@example.com"
                      aria-invalid={!!emailErrors.email || !!gateError}
                      aria-describedby={
                        emailErrors.email ? 'gate-email-error'
                        : gateError       ? 'gate-error-banner'
                        : undefined
                      }
                      className={`${inputCls(!!emailErrors.email || !!gateError)} pl-9 pr-3`}
                    />
                  </div>

                  {emailErrors.email && (
                    <p id="gate-email-error" role="alert" className="mt-1.5 text-xs text-error-500">
                      {t(emailErrors.email.message ?? '')}
                    </p>
                  )}

                  {gateError && (
                    <motion.div
                      id="gate-error-banner"
                      role="alert"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 flex items-start gap-2 px-3 py-2.5
                                 rounded-[var(--radius-md)] bg-error-50 border border-error-200"
                    >
                      <AlertCircle size={15} className="text-error-500 shrink-0 mt-0.5" aria-hidden="true" />
                      <p className="text-xs text-error-700 leading-relaxed">{gateError}</p>
                    </motion.div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isChecking || isSendingCode}
                  aria-busy={isChecking || isSendingCode}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                             rounded-[var(--radius-md)] bg-primary-600 hover:bg-primary-700
                             text-white text-sm font-medium transition-all duration-150
                             disabled:opacity-60 cursor-pointer shadow-sm hover:shadow-md"
                >
                  {isChecking || isSendingCode ? (
                    <>
                      <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                      {isFr ? 'Vérification…' : 'Checking…'}
                    </>
                  ) : (
                    <>
                      {isFr ? 'Continuer' : 'Continue'}
                      <ArrowRight size={15} aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          )}

          {/* ── STEP 2: Full register form ── */}
          {step === 'register' && (
            <motion.div
              key="register-form"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.22 }}
            >
              <VerifiedEmailBadge
                onBack={() => {
                  setStep('email-check');
                  setGateError('');
                  setFormError('');
                }}
              />

              {formError && (
                <motion.div
                  role="alert"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-2.5 px-3.5 py-3 mb-4
                             rounded-[var(--radius-md)] bg-error-50 border border-error-200"
                >
                  <AlertCircle size={15} className="text-error-500 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs text-error-700 leading-relaxed">{formError}</p>
                </motion.div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

                {/* Role selector */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-2">
                    {isFr ? 'Je suis…' : 'I am a…'}
                  </label>
                  <div className="grid grid-cols-2 gap-2" role="group" aria-label={isFr ? 'Rôle' : 'Role'}>
                    {ROLES.map(({ value, icon: Icon, label, labelFr }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setValue('role', value)}
                        aria-pressed={selectedRole === value}
                        className={`flex items-center gap-2.5 px-4 py-2.5
                                    rounded-[var(--radius-md)] border text-sm font-medium
                                    transition-all duration-150 cursor-pointer
                                    ${selectedRole === value
                                      ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                                      : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300'}`}
                      >
                        <Icon
                          size={16}
                          className={selectedRole === value ? 'text-primary-600' : 'text-surface-400'}
                          aria-hidden="true"
                        />
                        {isFr ? labelFr : label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Name row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1.5">
                      {t('auth.firstName')}
                    </label>
                    <div className="relative">
                      <User
                        size={15}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        {...register('firstName')}
                        type="text"
                        autoComplete="given-name"
                        placeholder={isFr ? 'Prénom' : 'First'}
                        aria-invalid={!!errors.firstName}
                        className={`${inputCls(!!errors.firstName)} pl-9 pr-3`}
                      />
                    </div>
                    {errors.firstName && (
                      <p role="alert" className="mt-1 text-xs text-error-500">
                        {errors.firstName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1.5">
                      {t('auth.lastName')}
                    </label>
                    <input
                      {...register('lastName')}
                      type="text"
                      autoComplete="family-name"
                      placeholder={isFr ? 'Nom' : 'Last'}
                      aria-invalid={!!errors.lastName}
                      className={`${inputCls(!!errors.lastName)} px-3`}
                    />
                    {errors.lastName && (
                      <p role="alert" className="mt-1 text-xs text-error-500">
                        {errors.lastName.message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    {t('auth.password')}
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      {...register('password', {
                        onChange: (e) => {
                          setPasswordValue(e.target.value);
                          setShowChecks(true);
                        },
                      })}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      onFocus={() => setShowChecks(true)}
                      aria-invalid={!!errors.password}
                      aria-describedby="password-strength"
                      className={`${inputCls(!!errors.password)} pl-9 pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors cursor-pointer"
                    >
                      {showPassword
                        ? <EyeOff size={15} aria-hidden="true" />
                        : <Eye size={15} aria-hidden="true" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p role="alert" className="mt-1 text-xs text-error-500">
                      {errors.password.message}
                    </p>
                  )}

                  <AnimatePresence>
                    {showChecks && passwordValue.length > 0 && (
                      <motion.div
                        id="password-strength"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="mt-2.5 space-y-2 overflow-hidden"
                        aria-live="polite"
                      >
                        <div className="flex gap-1 items-center">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                i <= score ? STRENGTH_COLORS[score] : 'bg-surface-200'
                              }`}
                            />
                          ))}
                          <span
                            className={`text-xs ml-1 font-medium ${
                              score >= 3
                                ? 'text-success-500'
                                : score >= 2
                                ? 'text-warning-500'
                                : 'text-error-500'
                            }`}
                          >
                            {isFr ? STRENGTH_LABELS_FR[score] : STRENGTH_LABELS[score]}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                          {checks.map((c) => (
                            <div key={c.label} className="flex items-center gap-1.5">
                              {c.pass
                                ? <CheckCircle2 size={13} className="text-success-500 shrink-0" aria-hidden="true" />
                                : <XCircle size={13} className="text-surface-300 shrink-0" aria-hidden="true" />}
                              <span className={`text-xs ${c.pass ? 'text-surface-600' : 'text-surface-400'}`}>
                                {isFr ? c.labelFr : c.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    {t('auth.confirmPassword')}
                  </label>
                  <div className="relative">
                    <Lock
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      {...register('confirmPassword')}
                      type={showConfirm ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      aria-invalid={!!errors.confirmPassword}
                      className={`${inputCls(!!errors.confirmPassword)} pl-9 pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? t('auth.hidePassword') : t('auth.showPassword')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors cursor-pointer"
                    >
                      {showConfirm
                        ? <EyeOff size={15} aria-hidden="true" />
                        : <Eye size={15} aria-hidden="true" />}
                    </button>
                  </div>
                  {errors.confirmPassword && (
                    <p role="alert" className="mt-1 text-xs text-error-500">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="w-full py-2.5 px-4 rounded-[var(--radius-md)]
                             bg-primary-600 hover:bg-primary-700 text-white
                             text-sm font-medium transition-all duration-150
                             disabled:opacity-60 disabled:cursor-not-allowed
                             cursor-pointer shadow-sm hover:shadow-md"
                >
                  {isSubmitting ? t('auth.signingUp') : t('auth.signUp')}
                </button>
              </form>

              <p className="text-center text-xs text-surface-400 mt-4 leading-relaxed">
                {t('auth.termsText')}{' '}
                <a href="#" className="text-primary-600 hover:underline">{t('auth.terms')}</a>{' '}
                {t('auth.and')}{' '}
                <a href="#" className="text-primary-600 hover:underline">{t('auth.privacy')}</a>
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-sm text-surface-500 mt-4">
          {t('auth.hasAccount')}{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary-600 hover:text-primary-700 font-medium transition-colors cursor-pointer"
          >
            {t('auth.signInLink')}
          </button>
        </p>
      </motion.div>

      {/* Email Verification Modal — rendered outside the form flow */}
      <EmailVerificationModal
        isOpen={showVerifyModal}
        email={verifiedEmail}
        onVerified={handleVerified}
        onBack={handleVerifyBack}
        codeSentAt={codeSentAt}
        expiresInMinutes={codeExpiresIn}
      />
    </>
  );
}