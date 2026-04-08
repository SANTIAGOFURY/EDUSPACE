import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Mail, Lock, AlertCircle } from 'lucide-react';
import { signInWithEmail, signInWithGoogle, AppError } from '../../services/auth';
import type { User } from 'firebase/auth';

// ─── Friendly error system ────────────────────────────────────────────────────

interface FriendlyError {
  message: string;
  hint?:   string;
  action?: { label: string; onClick: () => void };
}

function getFriendlyLoginError(
  err: unknown,
  isFr: boolean,
  onForgotPassword?: () => void,
): FriendlyError {
  const key = err instanceof AppError ? err.i18nKey : '';
  const raw = err instanceof AppError ? err.message : String(err);

  if (raw && (raw.includes('attempt') || raw.includes('Please wait') || raw.includes('Too many'))) {
    return { message: raw };
  }

  const map: Record<string, FriendlyError> = {
    'errors.invalidCredentials': {
      message: isFr
        ? 'Email ou mot de passe incorrect.'
        : 'Incorrect email or password.',
      hint: isFr
        ? 'Vérifiez votre saisie. Les mots de passe sont sensibles à la casse.'
        : 'Check your input. Passwords are case-sensitive.',
      action: onForgotPassword
        ? {
            label: isFr ? 'Mot de passe oublié ?' : 'Forgot your password?',
            onClick: onForgotPassword,
          }
        : undefined,
    },
    'errors.tooManyRequests': {
      message: isFr
        ? 'Trop de tentatives de connexion. Compte temporairement verrouillé.'
        : 'Too many sign-in attempts. Account temporarily locked.',
      hint: isFr
        ? 'Attendez quelques minutes avant de réessayer, ou réinitialisez votre mot de passe.'
        : 'Wait a few minutes before trying again, or reset your password.',
      action: onForgotPassword
        ? {
            label: isFr ? 'Réinitialiser le mot de passe' : 'Reset password',
            onClick: onForgotPassword,
          }
        : undefined,
    },
    'errors.userDisabled': {
      message: isFr
        ? 'Ce compte a été désactivé.'
        : 'This account has been disabled.',
      hint: isFr
        ? 'Contactez l\'administrateur pour réactiver votre accès.'
        : 'Contact your administrator to reactivate your access.',
    },
    'errors.networkError': {
      message: isFr ? 'Problème de connexion internet.' : 'Network connection problem.',
      hint:    isFr ? 'Vérifiez votre connexion et réessayez.' : 'Check your internet connection and try again.',
    },
    'errors.popupClosed': {
      message: isFr
        ? 'La fenêtre de connexion Google a été fermée.'
        : 'The Google sign-in window was closed.',
      hint: isFr ? 'Cliquez à nouveau pour réessayer.' : 'Click again to try once more.',
    },
    'errors.popupBlocked': {
      message: isFr
        ? 'La fenêtre Google a été bloquée par votre navigateur.'
        : 'The Google window was blocked by your browser.',
      hint: isFr
        ? 'Autorisez les pop-ups pour ce site dans les paramètres de votre navigateur.'
        : 'Allow pop-ups for this site in your browser settings.',
    },
    'errors.accountExistsDifferentProvider': {
      message: isFr
        ? 'Un compte existe déjà avec cet email, mais avec un autre mode de connexion.'
        : 'An account already exists with this email using a different sign-in method.',
      hint: isFr
        ? 'Essayez de vous connecter avec email/mot de passe à la place.'
        : 'Try signing in with email and password instead.',
    },
    'errors.genericError': {
      message: isFr ? 'Une erreur inattendue s\'est produite.' : 'An unexpected error occurred.',
      hint:    isFr ? 'Rechargez la page et réessayez.' : 'Refresh the page and try again.',
    },
  };

  return map[key] ?? {
    message: isFr ? 'Une erreur inattendue s\'est produite.' : 'An unexpected error occurred.',
    hint:    isFr ? 'Rechargez la page et réessayez.' : 'Refresh the page and try again.',
  };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LoginFormProps {
  onSuccess:            () => void;
  onGoogleNeedsProfile: (user: User) => void;
  onForgotPassword:     () => void;
  onSwitchToRegister:   () => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ErrorBanner({ error }: { error: FriendlyError }) {
  return (
    <motion.div
      role="alert"
      aria-live="assertive"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="flex flex-col gap-1.5 px-3.5 py-3 mb-4
                 rounded-[var(--radius-md)] bg-error-50 border border-error-200"
    >
      <div className="flex items-start gap-2.5">
        <AlertCircle size={15} className="text-error-500 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs font-medium text-error-700 leading-relaxed">{error.message}</p>
      </div>
      {error.hint && (
        <p className="text-xs text-error-600 leading-relaxed pl-5">{error.hint}</p>
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
  const [formError,       setFormError]    = useState<FriendlyError | null>(null);

  // ── Schema ────────────────────────────────────────────────────────────────

  const schema = z.object({
    email:    z.string()
      .min(1, isFr ? 'L\'adresse email est requise.' : 'Email address is required.')
      .email(isFr ? 'Cette adresse email n\'est pas valide.' : 'This email address is not valid.'),
    password: z.string()
      .min(1, isFr ? 'Le mot de passe est requis.' : 'Password is required.'),
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
    ${hasError || formError ? 'border-error-400 bg-error-50/30' : 'border-surface-200 hover:border-surface-300'}`;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    try {
      const { needsVerification } = await signInWithEmail(data.email, data.password);

      if (needsVerification) {
        setFormError({
          message: isFr
            ? 'Votre adresse email n\'a pas encore été vérifiée.'
            : 'Your email address has not been verified yet.',
          hint: isFr
            ? 'Vérifiez votre boîte mail pour le lien de confirmation, ou inscrivez-vous à nouveau.'
            : 'Check your inbox for the confirmation link, or sign up again.',
        });
        return;
      }

      toast.success(t('success.signIn'));
      onSuccess();
    } catch (err) {
      setFormError(getFriendlyLoginError(err, isFr, onForgotPassword));
    }
  };

  const handleGoogle = async () => {
    setFormError(null);
    setGoogleLoad(true);
    try {
      const result = await signInWithGoogle();
      if (!result) return; // Redirect initiated, result handled elsewhere
      const { user, needsProfile } = result;
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
        return; // silent — user closed the popup intentionally
      }
      setFormError(getFriendlyLoginError(err, isFr, onForgotPassword));
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
        {isGoogleLoading
          ? (isFr ? 'Connexion…' : 'Signing in…')
          : t('auth.google')}
      </button>

      {/* Divider */}
      <div className="relative flex items-center gap-3 mb-5">
        <div className="flex-1 h-px bg-surface-200" />
        <span className="text-xs text-surface-400">{t('auth.orContinueWith')}</span>
        <div className="flex-1 h-px bg-surface-200" />
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {formError && <ErrorBanner error={formError} />}
      </AnimatePresence>

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
          <AnimatePresence>
            {errors.email && <FieldError message={errors.email.message} />}
          </AnimatePresence>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-surface-700">
              {t('auth.password')}
            </label>
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
          <AnimatePresence>
            {errors.password && <FieldError message={errors.password.message} />}
          </AnimatePresence>
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