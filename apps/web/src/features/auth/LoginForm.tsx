import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import { signInWithEmail, signInWithGoogle, AppError } from '../../services/auth';
import type { User } from 'firebase/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoginFormProps {
  onSuccess:            () => void;
  onGoogleNeedsProfile: (user: User) => void;
  onForgotPassword:     () => void;   // opens ForgotPasswordModal in AuthPage
  onSwitchToRegister:   () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LoginForm({
  onSuccess,
  onGoogleNeedsProfile,
  onForgotPassword,
  onSwitchToRegister,
}: LoginFormProps) {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');

  const [showPassword,    setShowPassword] = useState(false);
  const [isGoogleLoading, setGoogleLoad]   = useState(false);
  const [formError,       setFormError]    = useState('');

  // ── Schema ────────────────────────────────────────────────────────────────

  const schema = z.object({
    email:    z.string().min(1, t('errors.emailRequired')).email(t('errors.emailInvalid')),
    password: z.string().min(1, t('errors.passwordRequired')),
  });
  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  // ── Helpers ───────────────────────────────────────────────────────────────

  const inputCls = (hasError: boolean) =>
    `w-full py-2.5 text-sm rounded-[var(--radius-md)] border bg-white transition-all duration-150
    placeholder:text-surface-300 text-surface-900
    focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
    ${hasError || formError ? 'border-error-400' : 'border-surface-200 hover:border-surface-300'}`;

  function resolveErrorMessage(err: unknown): string {
    if (err instanceof AppError) return t(err.i18nKey);
    return t('errors.genericError');
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormData) => {
    setFormError('');
    try {
      const { needsVerification } = await signInWithEmail(data.email, data.password);

      if (needsVerification) {
        // Account exists but email was never verified.
        // Surface a clear message — user should go through the register flow
        // or use "Forgot password" to recover. We do NOT re-send a code from
        // the login form; that path lives in AuthPage via ForgotPasswordModal.
        setFormError(
          isFr
            ? "Votre email n'est pas encore vérifié. Veuillez vous inscrire à nouveau ou contacter le support."
            : 'Your email is not yet verified. Please sign up again or contact support.',
        );
        return;
      }

      toast.success(t('success.signIn'));
      onSuccess();
    } catch (err) {
      setFormError(resolveErrorMessage(err));
    }
  };

  const handleGoogle = async () => {
    setFormError('');
    setGoogleLoad(true);
    try {
      const { user, needsProfile } = await signInWithGoogle();
      if (needsProfile) {
        onGoogleNeedsProfile(user);
      } else {
        toast.success(t('success.signIn'));
        onSuccess();
      }
    } catch (err) {
      if (
        err instanceof AppError &&
        (err.originalCode === 'auth/popup-closed-by-user' ||
         err.originalCode === 'auth/cancelled-popup-request')
      ) {
        return;
      }
      toast.error(resolveErrorMessage(err));
    } finally {
      setGoogleLoad(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.28, ease: [0.4, 0, 0.2, 1] }}
      className="w-full"
    >
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-semibold text-surface-900 tracking-tight mb-1.5"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {t('auth.welcome')}
        </h1>
        <p className="text-sm text-surface-500">{t('auth.welcomeSubtitle')}</p>
      </div>

      {/* Google sign-in */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={isGoogleLoading || isSubmitting}
        aria-busy={isGoogleLoading}
        className="w-full flex items-center justify-center gap-3 px-4 py-2.5
                   rounded-[var(--radius-md)] border border-surface-200 bg-white
                   text-sm font-medium text-surface-700
                   hover:bg-surface-50 hover:border-surface-300
                   transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed
                   mb-5 cursor-pointer"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        {isGoogleLoading ? (isFr ? 'Connexion…' : 'Signing in…') : t('auth.google')}
      </button>

      {/* Divider */}
      <div className="relative flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-surface-200" />
        <span className="text-xs text-surface-400">{t('auth.orContinueWith')}</span>
        <div className="flex-1 h-px bg-surface-200" />
      </div>

      {/* Error banner */}
      {formError && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-2.5 px-3.5 py-3 mb-4
                     rounded-[var(--radius-md)] bg-error-50 border border-error-200"
          role="alert"
        >
          <AlertCircle size={15} className="text-error-500 shrink-0 mt-0.5" />
          <p className="text-xs text-error-700 leading-relaxed">{formError}</p>
        </motion.div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">
            {t('auth.email')}
          </label>
          <div className="relative">
            <Mail
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
            />
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={!!errors.email}
              className={`${inputCls(!!errors.email)} pl-9 pr-4`}
            />
          </div>
          {errors.email && (
            <p role="alert" className="mt-1.5 text-xs text-error-500">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-surface-700">
              {t('auth.password')}
            </label>
            {/*
             * Delegates to AuthPage's onForgotPassword → opens ForgotPasswordModal.
             * No reset or verification logic lives inside LoginForm.
             */}
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium transition-colors cursor-pointer"
            >
              {t('auth.forgotPassword')}
            </button>
          </div>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
            />
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={!!errors.password}
              className={`${inputCls(!!errors.password)} pl-9 pr-10`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && (
            <p role="alert" className="mt-1.5 text-xs text-error-500">
              {errors.password.message}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          aria-busy={isSubmitting}
          className="w-full py-2.5 px-4 rounded-[var(--radius-md)]
                     bg-primary-600 hover:bg-primary-700 text-white
                     text-sm font-medium transition-all duration-150
                     disabled:opacity-60 disabled:cursor-not-allowed
                     mt-1 cursor-pointer shadow-sm hover:shadow-md"
        >
          {isSubmitting ? t('auth.signingIn') : t('auth.signIn')}
        </button>
      </form>

      <p className="text-center text-sm text-surface-500 mt-6">
        {t('auth.noAccount')}{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-primary-600 hover:text-primary-700 font-medium transition-colors cursor-pointer"
        >
          {t('auth.signUpLink')}
        </button>
      </p>
    </motion.div>
  );
}