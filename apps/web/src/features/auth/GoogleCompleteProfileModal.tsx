import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Phone, GraduationCap, BookOpen, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { completeUserProfile, AppError } from '../../services/auth';
import type { User as FirebaseUser } from 'firebase/auth';
import { useState } from 'react';

interface Props {
  isOpen: boolean;
  user: FirebaseUser;
  onComplete: () => void;
}

const ROLES = [
  { value: 'student', icon: GraduationCap, label: 'Student', labelFr: 'Étudiant' },
  { value: 'teacher', icon: BookOpen,      label: 'Teacher', labelFr: 'Enseignant' },
] as const;

export function GoogleCompleteProfileModal({ isOpen, user, onComplete }: Props) {
  const { t, i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');

  const [formError, setFormError]   = useState('');
  // Separate flag: true after the Cloud Function succeeded but while we wait
  // for AuthContext to confirm profileComplete. Keeps the button in a loading
  // state and prevents double-submission.
  const [waitingForContext, setWaitingForContext] = useState(false);

  const [defaultFirst = '', defaultLast = ''] = (user.displayName ?? '').split(' ');

  const schema = z.object({
    firstName: z.string().min(2, isFr ? 'Minimum 2 caractères' : 'At least 2 characters').max(50),
    lastName:  z.string().min(2, isFr ? 'Minimum 2 caractères' : 'At least 2 characters').max(50),
    role:      z.enum(['student', 'teacher']),
    phone: z
      .string()
      .regex(/^\+?[\d\s\-()]{7,20}$/, isFr ? 'Numéro invalide' : 'Invalid phone number')
      .optional()
      .or(z.literal('')),
  });

  type FormData = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: defaultFirst, lastName: defaultLast, role: 'student', phone: '' },
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: FormData) => {
    setFormError('');
    try {
      await completeUserProfile({
        firstName: data.firstName,
        lastName:  data.lastName,
        role:      data.role,
        phone:     data.phone || undefined,
      });

      // Cloud Function succeeded. Tell the parent to start watching
      // AuthContext for profileComplete. We show a waiting spinner until
      // the parent unmounts this modal (after context confirms the write).
      setWaitingForContext(true);
      onComplete();

    } catch (err) {
      setWaitingForContext(false);
      setFormError(err instanceof AppError ? t(err.i18nKey) : t('errors.genericError'));
    }
  };

  const inputCls = (hasError: boolean) =>
    `w-full px-3 py-2.5 text-sm rounded-[var(--radius-md)] border bg-white
    transition-all duration-150 placeholder:text-surface-300 text-surface-900
    focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400
    ${hasError ? 'border-error-400' : 'border-surface-200 hover:border-surface-300'}`;

  const isBusy = isSubmitting || waitingForContext;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm z-50"
            aria-hidden="true"
          />

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
              {/* Header */}
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

              {/* Form */}
              <form onSubmit={handleSubmit(onSubmit)} noValidate className="px-7 py-6 space-y-4">

                {formError && (
                  <motion.div
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5 px-3.5 py-3 rounded-[var(--radius-md)] bg-error-50 border border-error-200"
                  >
                    <AlertCircle size={15} className="text-error-500 shrink-0 mt-0.5" aria-hidden="true" />
                    <p className="text-xs text-error-700 leading-relaxed">{formError}</p>
                  </motion.div>
                )}

                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-surface-600 mb-1.5">
                      {t('auth.firstName')}
                    </label>
                    <input
                      {...register('firstName')}
                      type="text"
                      autoComplete="given-name"
                      placeholder={isFr ? 'Prénom' : 'First name'}
                      aria-invalid={!!errors.firstName}
                      className={inputCls(!!errors.firstName)}
                    />
                    {errors.firstName && (
                      <p role="alert" className="mt-1 text-xs text-error-500">{errors.firstName.message}</p>
                    )}
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
                    {errors.lastName && (
                      <p role="alert" className="mt-1 text-xs text-error-500">{errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-2">
                    {isFr ? 'Je suis…' : 'I am a…'}
                  </label>
                  <div className="grid grid-cols-2 gap-2.5" role="group" aria-label={isFr ? 'Rôle' : 'Role'}>
                    {ROLES.map(({ value, icon: Icon, label, labelFr }) => (
                      <button
                        key={value}
                        type="button"
                        disabled={isBusy}
                        onClick={() => setValue('role', value)}
                        aria-pressed={selectedRole === value}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-[var(--radius-md)]
                                    border text-sm font-medium transition-all duration-150 cursor-pointer
                                    disabled:opacity-50 disabled:cursor-not-allowed
                                    ${selectedRole === value
                                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                                      : 'border-surface-200 bg-white text-surface-600 hover:border-surface-300 hover:bg-surface-50'}`}
                      >
                        <Icon size={16} className={selectedRole === value ? 'text-primary-600' : 'text-surface-400'} aria-hidden="true" />
                        {isFr ? labelFr : label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-medium text-surface-600 mb-1.5">
                    {isFr ? 'Téléphone' : 'Phone'}{' '}
                    <span className="text-surface-400 font-normal">({isFr ? 'optionnel' : 'optional'})</span>
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" aria-hidden="true" />
                    <input
                      {...register('phone')}
                      type="tel"
                      autoComplete="tel"
                      placeholder="+212 6 00 00 00 00"
                      aria-invalid={!!errors.phone}
                      className={`${inputCls(!!errors.phone)} pl-9`}
                    />
                  </div>
                  {errors.phone && (
                    <p role="alert" className="mt-1 text-xs text-error-500">{errors.phone.message}</p>
                  )}
                </div>

                {/* Email display */}
                <div className="px-3 py-2.5 rounded-[var(--radius-md)] bg-surface-50 border border-surface-200 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-success-500 shrink-0" aria-hidden="true" />
                  <span className="text-xs text-surface-500">
                    {isFr ? 'Compte Google connecté :' : 'Google account:'}{' '}
                    <span className="font-medium text-surface-700">{user.email}</span>
                  </span>
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