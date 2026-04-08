import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Phone, Sparkles, AlertCircle, Loader2, AtSign, Calendar, Info,
} from 'lucide-react';
import { completeUserProfile, AppError } from '../../services/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  user: FirebaseUser;
  onComplete: () => void;
}

// ─── Friendly error resolution ────────────────────────────────────────────────

interface FriendlyError {
  message: string;
  hint?:   string;
}

function getFriendlyError(err: unknown, isFr: boolean): FriendlyError {
  const key = err instanceof AppError ? err.i18nKey : '';
  const raw = err instanceof AppError ? err.message : String(err);

  if (raw && (raw.includes('attempt') || raw.includes('Please wait') || raw.includes('Too many'))) {
    return { message: raw };
  }

  const map: Record<string, FriendlyError> = {
    'errors.tooManyRequests': {
      message: isFr ? 'Trop de tentatives.' : 'Too many attempts.',
      hint:    isFr ? 'Veuillez patienter quelques minutes avant de réessayer.' : 'Please wait a few minutes before trying again.',
    },
    'errors.networkError': {
      message: isFr ? 'Problème de connexion internet.' : 'Network connection problem.',
      hint:    isFr ? 'Vérifiez votre connexion et réessayez.' : 'Check your internet connection and try again.',
    },
    'errors.unauthenticated': {
      message: isFr ? 'Session expirée.' : 'Your session has expired.',
      hint:    isFr ? 'Rechargez la page et reconnectez-vous.' : 'Reload the page and sign in again.',
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <motion.p
      role="alert"
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1 flex items-center gap-1.5 text-xs text-error-500"
    >
      <AlertCircle size={11} className="shrink-0" aria-hidden="true" />
      {message}
    </motion.p>
  );
}

function FieldHint({ message }: { message: string }) {
  return (
    <p className="mt-1 flex items-center gap-1.5 text-xs text-surface-400">
      <Info size={11} className="shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GoogleCompleteProfileModal({ isOpen, user, onComplete }: Props) {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');

  const [formError, setFormError]           = useState<FriendlyError | null>(null);
  const [waitingForContext, setWaiting]     = useState(false);

  const [defaultFirst = '', defaultLast = ''] = (user.displayName ?? '').split(' ');

  // ── Birthday bounds ──────────────────────────────────────────────────────
  const today  = new Date();
  const minAge = new Date(today.getFullYear() - 6,   today.getMonth(), today.getDate());
  const maxAge = new Date(today.getFullYear() - 120,  today.getMonth(), today.getDate());

  // ── Schema ────────────────────────────────────────────────────────────────
  const schema = z.object({
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
      .max(30, isFr ? 'Nom d\'utilisateur trop long (max 30).' : 'Username too long (max 30).')
      .regex(
        /^[a-z0-9_.-]+$/,
        isFr
          ? 'Uniquement lettres minuscules, chiffres, tirets, points et underscores.'
          : 'Only lowercase letters, numbers, hyphens, dots, and underscores.',
      ),
    birthday: z
      .string()
      .min(1, isFr ? 'La date de naissance est requise.' : 'Date of birth is required.')
      .refine(
        (val) => {
          const d = new Date(val);
          return !isNaN(d.getTime()) && d <= minAge && d >= maxAge;
        },
        isFr ? 'Veuillez entrer une date de naissance valide.' : 'Please enter a valid date of birth.',
      ),
    phone: z
      .string()
      .regex(/^\+?[\d\s\-()]{7,20}$/, isFr ? 'Numéro de téléphone invalide.' : 'Invalid phone number.')
      .optional()
      .or(z.literal('')),
  });

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: defaultFirst,
      lastName:  defaultLast,
      username:  '',
      birthday:  '',
      phone:     '',
    },
  });

  // ── Submit ────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormData) => {
    setFormError(null);
    try {
      await completeUserProfile({
        firstName: data.firstName,
        lastName:  data.lastName,
        username:  data.username,
        birthday:  data.birthday,
        phone:     data.phone || undefined,
      });
      setWaiting(true);
      onComplete();
    } catch (err) {
      setWaiting(false);
      setFormError(getFriendlyError(err, isFr));
    }
  };

  // ── Input class ───────────────────────────────────────────────────────────

  const inputCls = (hasError: boolean) =>
    `w-full px-3 py-2.5 text-sm rounded-[var(--radius-md)] border bg-white
    transition-all duration-150 placeholder:text-surface-300 text-surface-900
    focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
    ${hasError ? 'border-error-400 bg-error-50/30' : 'border-surface-200 hover:border-surface-300'}`;

  const isBusy = isSubmitting || waitingForContext;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm z-50"
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="complete-profile-title"
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-md bg-white rounded-[var(--radius-xl)] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ── Header ── */}
              <div className="bg-gradient-to-r from-primary-600 to-primary-500 px-7 pt-7 pb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles size={16} className="text-primary-200" aria-hidden="true" />
                      <span className="text-primary-200 text-xs font-medium">
                        {isFr ? 'Presque prêt !' : 'Almost there!'}
                      </span>
                    </div>
                    <h2
                      id="complete-profile-title"
                      className="text-xl font-semibold text-white mb-1"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {isFr ? 'Complétez votre profil' : 'Complete your profile'}
                    </h2>
                    <p className="text-primary-200 text-sm">
                      {isFr
                        ? 'Quelques infos pour personnaliser votre expérience'
                        : 'A few details to personalise your experience'}
                    </p>
                  </div>

                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="w-12 h-12 rounded-full border-2 border-white/30 object-cover"
                    />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-full bg-primary-400 flex items-center justify-center border-2 border-white/30"
                      aria-hidden="true"
                    >
                      <User size={20} className="text-white" />
                    </div>
                  )}
                </div>
              </div>

              {/* ── Form ── */}
              <form
                onSubmit={handleSubmit(onSubmit)}
                noValidate
                className="px-7 py-6 space-y-4 max-h-[70vh] overflow-y-auto"
              >
                {/* Error banner */}
                <AnimatePresence>
                  {formError && (
                    <motion.div
                      role="alert"
                      aria-live="assertive"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex flex-col gap-1.5 px-3.5 py-3 rounded-[var(--radius-md)] bg-error-50 border border-error-200"
                    >
                      <div className="flex items-start gap-2.5">
                        <AlertCircle size={15} className="text-error-500 shrink-0 mt-0.5" aria-hidden="true" />
                        <p className="text-xs font-medium text-error-700 leading-relaxed">{formError.message}</p>
                      </div>
                      {formError.hint && (
                        <p className="text-xs text-error-600 leading-relaxed pl-5">{formError.hint}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Google account indicator */}
                <div className="px-3 py-2.5 rounded-[var(--radius-md)] bg-surface-50 border border-surface-200 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-success-500 shrink-0" aria-hidden="true" />
                  <span className="text-xs text-surface-500">
                    {isFr ? 'Compte Google :' : 'Google account:'}{' '}
                    <span className="font-medium text-surface-700">{user.email}</span>
                  </span>
                </div>

                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1.5">
                      {t('auth.firstName')}
                    </label>
                    <div className="relative">
                      <User
                        size={14}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        {...register('firstName')}
                        type="text"
                        autoComplete="given-name"
                        placeholder={isFr ? 'Prénom' : 'First name'}
                        aria-invalid={!!errors.firstName}
                        className={`${inputCls(!!errors.firstName)} pl-8`}
                      />
                    </div>
                    <FieldError message={errors.firstName?.message} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1.5">
                      {t('auth.lastName')}
                    </label>
                    <input
                      {...register('lastName')}
                      type="text"
                      autoComplete="family-name"
                      placeholder={isFr ? 'Nom' : 'Last name'}
                      aria-invalid={!!errors.lastName}
                      className={inputCls(!!errors.lastName)}
                    />
                    <FieldError message={errors.lastName?.message} />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1.5">
                    {isFr ? 'Nom d\'utilisateur' : 'Username'}
                  </label>
                  <div className="relative">
                    <AtSign
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      {...register('username')}
                      type="text"
                      autoComplete="username"
                      placeholder="john_doe"
                      aria-invalid={!!errors.username}
                      className={`${inputCls(!!errors.username)} pl-8`}
                    />
                  </div>
                  {errors.username
                    ? <FieldError message={errors.username.message} />
                    : <FieldHint message={
                        isFr
                          ? 'Lettres minuscules, chiffres et underscores uniquement.'
                          : 'Lowercase letters, numbers, and underscores only.'
                      } />
                  }
                </div>

                {/* Birthday */}
                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1.5">
                    {isFr ? 'Date de naissance' : 'Date of birth'}
                  </label>
                  <div className="relative">
                    <Calendar
                      size={14}
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
                      className={`${inputCls(!!errors.birthday)} pl-8`}
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

                {/* Phone (optional) */}
                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1.5">
                    {isFr ? 'Téléphone' : 'Phone'}{' '}
                    <span className="text-surface-400 font-normal">
                      ({isFr ? 'optionnel' : 'optional'})
                    </span>
                  </label>
                  <div className="relative">
                    <Phone
                      size={14}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      {...register('phone')}
                      type="tel"
                      autoComplete="tel"
                      placeholder="+212 6 00 00 00 00"
                      aria-invalid={!!errors.phone}
                      className={`${inputCls(!!errors.phone)} pl-8`}
                    />
                  </div>
                  {errors.phone && <FieldError message={errors.phone.message} />}
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isBusy}
                  aria-busy={isBusy}
                  className="w-full py-2.5 px-4 rounded-[var(--radius-md)]
                             bg-primary-600 hover:bg-primary-700 text-white
                             text-sm font-medium transition-all duration-150
                             disabled:opacity-60 disabled:cursor-not-allowed
                             cursor-pointer shadow-sm hover:shadow-md mt-1
                             flex items-center justify-center gap-2"
                >
                  {isBusy && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
                  {waitingForContext
                    ? (isFr ? 'Redirection…' : 'Redirecting…')
                    : isSubmitting
                      ? (isFr ? 'Enregistrement…' : 'Saving…')
                      : (isFr ? 'Accéder à mon espace' : 'Go to my dashboard')}
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}