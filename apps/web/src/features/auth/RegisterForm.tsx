import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Eye, EyeOff, Mail, Lock, User, AtSign, Calendar,
  CheckCircle2, XCircle, ArrowRight, Loader2, AlertCircle, Info,
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

// ─── Friendly error messages ──────────────────────────────────────────────────

interface FriendlyError {
  message: string;
  hint?:   string;
  action?: { label: string; onClick: () => void };
}

function getFriendlyError(
  err: unknown,
  isFr: boolean,
  onSwitchToLogin?: () => void,
): FriendlyError {
  const key = err instanceof AppError ? err.i18nKey : '';
  const raw = err instanceof AppError ? err.message : String(err);

  // Map known i18n keys → friendly copy
  const friendlyMap: Record<string, FriendlyError> = {
    'errors.emailInUse': {
      message: isFr
        ? 'Un compte existe déjà avec cette adresse email.'
        : 'An account already exists with this email address.',
      hint: isFr
        ? 'Essayez de vous connecter, ou utilisez "Mot de passe oublié" si vous avez perdu l\'accès.'
        : 'Try signing in instead, or use "Forgot password" if you lost access.',
      action: onSwitchToLogin
        ? { label: isFr ? 'Se connecter' : 'Sign in', onClick: onSwitchToLogin }
        : undefined,
    },
    'errors.signupBlocked': {
      message: isFr
        ? 'Votre adresse email n\'est pas autorisée à créer un compte.'
        : 'Your email address is not authorised to create an account.',
      hint: isFr
        ? 'Contactez l\'administrateur pour obtenir l\'accès.'
        : 'Contact your administrator to request access.',
    },
    'errors.emailInvalid': {
      message: isFr ? 'Cette adresse email n\'est pas valide.' : 'This email address is not valid.',
      hint: isFr ? 'Vérifiez qu\'il n\'y a pas de faute de frappe.' : 'Check for any typos.',
    },
    'errors.weakPassword': {
      message: isFr ? 'Votre mot de passe est trop simple.' : 'Your password is too simple.',
      hint: isFr
        ? 'Utilisez au moins 8 caractères avec majuscules, chiffres et symboles.'
        : 'Use at least 8 characters with uppercase letters, numbers, and symbols.',
    },
    'errors.networkError': {
      message: isFr ? 'Problème de connexion internet.' : 'Network connection problem.',
      hint: isFr
        ? 'Vérifiez votre connexion et réessayez.'
        : 'Check your internet connection and try again.',
    },
    'errors.tooManyRequests': {
      message: isFr
        ? 'Trop de tentatives. Veuillez patienter quelques minutes.'
        : 'Too many attempts. Please wait a few minutes.',
      hint: isFr
        ? 'Votre compte est temporairement protégé. Réessayez dans 5 minutes.'
        : 'Your account is temporarily protected. Try again in 5 minutes.',
    },
    'errors.genericError': {
      message: isFr
        ? 'Une erreur inattendue s\'est produite.'
        : 'An unexpected error occurred.',
      hint: isFr
        ? 'Rechargez la page et réessayez. Si le problème persiste, contactez le support.'
        : 'Refresh the page and try again. If the problem persists, contact support.',
    },
    'errors.notFound': {
      message: isFr
        ? 'Email non trouvé dans la liste des utilisateurs autorisés.'
        : 'Email not found in the list of authorised users.',
      hint: isFr
        ? 'Vérifiez l\'orthographe ou contactez votre administrateur.'
        : 'Double-check the spelling or contact your administrator.',
    },
  };

  // Passthrough messages from the server (attempt counts, cooldowns, etc.)
  if (raw && (
    raw.includes('attempt') || raw.includes('expired') ||
    raw.includes('Please wait') || raw.includes('Too many')
  )) {
    return { message: raw };
  }

  return friendlyMap[key] ?? {
    message: isFr ? 'Une erreur inattendue s\'est produite.' : 'An unexpected error occurred.',
    hint:    isFr ? 'Rechargez la page et réessayez.' : 'Refresh the page and try again.',
  };
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const emailSchema = z.object({
  email: z.string().min(1, 'errors.emailRequired').email('errors.emailInvalid'),
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

// ─── Error Banner ─────────────────────────────────────────────────────────────

function ErrorBanner({
  error,
  className = '',
}: {
  error: FriendlyError;
  className?: string;
}) {
  return (
    <motion.div
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className={`flex flex-col gap-1.5 px-3.5 py-3 rounded-[var(--radius-md)] bg-error-50 border border-error-200 ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle size={15} className="text-error-500 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs font-medium text-error-700 leading-relaxed">{error.message}</p>
      </div>
      {error.hint && (
        <div className="flex items-start gap-2.5 pl-5">
          <p className="text-xs text-error-600 leading-relaxed">{error.hint}</p>
        </div>
      )}
      {error.action && (
        <div className="pl-5">
          <button
            type="button"
            onClick={error.action.onClick}
            className="text-xs font-semibold text-error-700 underline underline-offset-2 hover:text-error-800 cursor-pointer transition-colors"
          >
            {error.action.label} →
          </button>
        </div>
      )}
    </motion.div>
  );
}

// ─── Field Error ──────────────────────────────────────────────────────────────

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <motion.p
      role="alert"
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1.5 flex items-center gap-1.5 text-xs text-error-500"
    >
      <AlertCircle size={11} className="shrink-0" aria-hidden="true" />
      {message}
    </motion.p>
  );
}

// ─── Field Hint ───────────────────────────────────────────────────────────────

function FieldHint({ message }: { message: string }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-surface-400">
      <Info size={11} className="shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
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
  const [gateError, setGateError]         = useState<FriendlyError | null>(null);

  // ── Verification modal state ──
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [codeSentAt, setCodeSentAt]           = useState<Date | null>(null);
  const [codeExpiresIn, setCodeExpiresIn]     = useState<number | undefined>(undefined);

  // ── Register form state ──
  const [formError, setFormError]         = useState<FriendlyError | null>(null);
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
  const today = new Date();
  const minAge = new Date(today.getFullYear() - 6, today.getMonth(), today.getDate());
  const maxAge = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate());

  const registerSchema = z.object({
    firstName: z
      .string()
      .min(2, isFr ? 'Le prénom doit contenir au moins 2 caractères.' : 'First name must be at least 2 characters.')
      .max(50, isFr ? 'Le prénom est trop long.' : 'First name is too long.'),
    lastName: z
      .string()
      .min(2, isFr ? 'Le nom doit contenir au moins 2 caractères.' : 'Last name must be at least 2 characters.')
      .max(50, isFr ? 'Le nom est trop long.' : 'Last name is too long.'),
    username: z
      .string()
      .min(3, isFr ? 'Le nom d\'utilisateur doit avoir au moins 3 caractères.' : 'Username must be at least 3 characters.')
      .max(30, isFr ? 'Le nom d\'utilisateur est trop long (max 30).' : 'Username is too long (max 30).')
      .regex(
        /^[a-z0-9_.-]+$/,
        isFr
          ? 'Uniquement des lettres minuscules, chiffres, tirets, points et underscores.'
          : 'Only lowercase letters, numbers, hyphens, dots, and underscores.',
      ),
    birthday: z
      .string()
      .min(1, isFr ? 'La date de naissance est requise.' : 'Date of birth is required.')
      .refine((val) => {
        const d = new Date(val);
        return !isNaN(d.getTime()) && d <= minAge && d >= maxAge;
      }, isFr ? 'Veuillez entrer une date de naissance valide.' : 'Please enter a valid date of birth.'),
    password: z
      .string()
      .min(8, isFr ? 'Le mot de passe doit contenir au moins 8 caractères.' : 'Password must be at least 8 characters.'),
    confirmPassword: z
      .string()
      .min(1, isFr ? 'Veuillez confirmer votre mot de passe.' : 'Please confirm your password.'),
  }).refine((d) => d.password === d.confirmPassword, {
    message: isFr ? 'Les mots de passe ne correspondent pas.' : 'Passwords do not match.',
    path:    ['confirmPassword'],
  });

  type RegisterData = z.infer<typeof registerSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema) });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const resolveFriendly = useCallback(
    (err: unknown) => getFriendlyError(err, isFr, onSwitchToLogin),
    [isFr, onSwitchToLogin],
  );

  const inputCls = useCallback(
    (hasError: boolean) =>
      `w-full py-2.5 text-sm rounded-[var(--radius-md)] border bg-white transition-all duration-150
       placeholder:text-surface-300 text-surface-900
       focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
       ${hasError ? 'border-error-400 bg-error-50/30' : 'border-surface-200 hover:border-surface-300'}`,
    [],
  );

  // ── Step 1: email gate ────────────────────────────────────────────────────

  const onEmailCheck = async ({ email }: { email: string }) => {
    setGateError(null);
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
      setGateError(resolveFriendly(err));
    } finally {
      setIsChecking(false);
      setIsSendingCode(false);
    }
  };

  // ── Verification callbacks ────────────────────────────────────────────────

  const handleVerified = () => {
    setShowVerifyModal(false);
    setStep('register');
  };

  const handleVerifyBack = () => setShowVerifyModal(false);

  // ── Step 2: register ──────────────────────────────────────────────────────

  const onSubmit = async (data: RegisterData) => {
    setFormError(null);

    if (score < 3) {
      setFormError({
        message: isFr
          ? 'Votre mot de passe est trop faible.'
          : 'Your password is too weak.',
        hint: isFr
          ? 'Ajoutez des lettres majuscules, des chiffres ou des caractères spéciaux pour le renforcer.'
          : 'Add uppercase letters, numbers, or special characters to make it stronger.',
      });
      return;
    }

    try {
      await validateSignupEmail(verifiedEmail);
    } catch (err) {
      setFormError(resolveFriendly(err));
      return;
    }

    try {
      await signUpWithEmail(
        verifiedEmail,
        data.password,
        data.firstName,
        data.lastName,
        data.username,
        data.birthday,
      );
      toast.success(t('success.signUp'));
      onSuccess();
    } catch (err) {
      setFormError(resolveFriendly(err));
    }
  };

  // ── Verified email badge ──────────────────────────────────────────────────

  const VerifiedEmailBadge = ({ onBack }: { onBack: () => void }) => (
    <div className="flex items-center justify-between mb-4 px-3 py-2
                    rounded-[var(--radius-md)] bg-success-50 border border-success-200">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={14} className="text-success-500" aria-hidden="true" />
        <span className="text-xs text-success-700 font-medium">{verifiedEmail}</span>
        <span className="text-xs text-success-500">
          {isFr ? '· vérifié' : '· verified'}
        </span>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="text-xs text-surface-500 hover:text-surface-700 underline cursor-pointer transition-colors"
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
                      className={`${inputCls(!!emailErrors.email || !!gateError)} pl-9 pr-3`}
                    />
                  </div>

                  <AnimatePresence>
                    {emailErrors.email && (
                      <FieldError message={
                        emailErrors.email.message === 'errors.emailRequired'
                          ? (isFr ? 'L\'adresse email est requise.' : 'Email address is required.')
                          : (isFr ? 'Cette adresse email n\'est pas valide.' : 'This email address is not valid.')
                      } />
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {gateError && (
                      <div className="mt-2">
                        <ErrorBanner error={gateError} />
                      </div>
                    )}
                  </AnimatePresence>
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
                  setGateError(null);
                  setFormError(null);
                }}
              />

              <AnimatePresence>
                {formError && (
                  <ErrorBanner error={formError} className="mb-4" />
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">

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
                    <FieldError message={errors.firstName?.message} />
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
                    <FieldError message={errors.lastName?.message} />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    {isFr ? 'Nom d\'utilisateur' : 'Username'}
                  </label>
                  <div className="relative">
                    <AtSign
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      {...register('username')}
                      type="text"
                      autoComplete="username"
                      placeholder="john_doe"
                      aria-invalid={!!errors.username}
                      className={`${inputCls(!!errors.username)} pl-9 pr-3`}
                    />
                  </div>
                  {errors.username
                    ? <FieldError message={errors.username.message} />
                    : <FieldHint message={
                        isFr
                          ? 'Lettres minuscules, chiffres, tirets et underscores uniquement.'
                          : 'Lowercase letters, numbers, hyphens, and underscores only.'
                      } />
                  }
                </div>

                {/* Birthday */}
                <div>
                  <label className="block text-sm font-medium text-surface-700 mb-1.5">
                    {isFr ? 'Date de naissance' : 'Date of birth'}
                  </label>
                  <div className="relative">
                    <Calendar
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      {...register('birthday')}
                      type="date"
                      autoComplete="bday"
                      max={minAge.toISOString().split('T')[0]}
                      min={maxAge.toISOString().split('T')[0]}
                      aria-invalid={!!errors.birthday}
                      className={`${inputCls(!!errors.birthday)} pl-9 pr-3`}
                    />
                  </div>
                  {errors.birthday
                    ? <FieldError message={errors.birthday.message} />
                    : <FieldHint message={
                        isFr
                          ? 'Votre date de naissance ne sera pas partagée publiquement.'
                          : 'Your date of birth won\'t be shared publicly.'
                      } />
                  }
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
                  <FieldError message={errors.password?.message} />

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
                  <FieldError message={errors.confirmPassword?.message} />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4
                             rounded-[var(--radius-md)] bg-primary-600 hover:bg-primary-700
                             text-white text-sm font-medium transition-all duration-150
                             disabled:opacity-60 disabled:cursor-not-allowed
                             cursor-pointer shadow-sm hover:shadow-md"
                >
                  {isSubmitting && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  {isSubmitting
                    ? t('auth.signingUp')
                    : (isFr ? 'Créer mon compte' : 'Create account')}
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