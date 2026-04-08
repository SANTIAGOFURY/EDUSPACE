import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { LoginForm } from '../../features/auth/LoginForm';
import { RegisterForm } from '../../features/auth/RegisterForm';
import { ForgotPasswordModal } from '../../features/auth/ForgotPasswordModal';
import { GoogleCompleteProfileModal } from '../../features/auth/GoogleCompleteProfileModal';
import { handleGoogleRedirectResult, AppError } from '../../services/auth';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import type { User } from 'firebase/auth';
import { useAuth } from '../../context/AuthContext';

type AuthView = 'login' | 'register';

export default function AuthPage() {
  const navigate                       = useNavigate();
  const { t }                          = useTranslation();
  const { user, profile, loading, profileLoading } = useAuth();

  const [view, setView]                = useState<AuthView>('login');
  const [showForgot, setShowForgot]    = useState(false);
  const [googleUser, setGoogleUser]    = useState<User | null>(null);
  const [redirectChecked, setRedirectChecked] = useState(false);

  // Tracks that WE triggered completeProfile — prevents the fallback effect
  // from re-opening the modal on unrelated profile reloads.
  const completingProfileRef = useRef(false);

  const isBusy = loading || profileLoading;

  // ── Guard: already fully signed-in → go to dashboard ───────────────────
  useEffect(() => {
    if (isBusy) return;
    if (!redirectChecked) return;
    if (!user || !profile) return;
    if (!profile.profileComplete) return;
    if (googleUser) return;

    navigate('/dashboard', { replace: true });
  }, [isBusy, redirectChecked, user, profile, googleUser, navigate]);

  // ── Navigate once profile completion is confirmed in context ────────────
  useEffect(() => {
    if (!completingProfileRef.current) return;
    if (isBusy) return;
    if (!profile?.profileComplete) return;

    completingProfileRef.current = false;
    setGoogleUser(null);
    navigate('/dashboard', { replace: true });
  }, [profile?.profileComplete, isBusy, navigate]);

  // ── Handle Google redirect result on page load ──────────────────────────
  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const result = await handleGoogleRedirectResult();
        if (!active) return;

        if (result?.needsProfile) {
          setGoogleUser(result.user);
        } else if (result) {
          toast.success(t('success.signIn'));
          navigate('/dashboard', { replace: true });
        }
      } catch (err) {
        if (!active) return;
        toast.error(err instanceof AppError ? t(err.i18nKey) : t('errors.genericError'));
      } finally {
        if (active) setRedirectChecked(true);
      }
    })();

    return () => { active = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fallback: profile incomplete and no modal open yet ──────────────────
  useEffect(() => {
    if (!redirectChecked) return;
    if (isBusy) return;
    if (completingProfileRef.current) return;
    if (googleUser) return;
    if (!user || !profile) return;
    if (profile.profileComplete) return;

    setGoogleUser(user);
  }, [redirectChecked, isBusy, user, profile, googleUser]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleAuthSuccess = () => navigate('/dashboard', { replace: true });

  const handleGoogleNeedsProfile = (firebaseUser: User) => {
    completingProfileRef.current = false;
    setGoogleUser(firebaseUser);
  };

  const handleProfileComplete = () => {
    completingProfileRef.current = true;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    /*
     * IMPORTANT: No element in this tree may use backdrop-filter/blur,
     * will-change, transform, or filter — those CSS properties create a new
     * stacking/compositing context that traps `position: fixed` descendants
     * (ForgotPasswordModal, EmailVerificationModal, GoogleCompleteProfileModal)
     * inside the element's bounds instead of covering the full viewport.
     */
    <div className="auth-bg noise-bg min-h-screen relative flex flex-col">
      <header className="relative z-10 flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[var(--radius-md)] bg-primary-600 flex items-center justify-center shadow-sm">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 12V6.5L8 3l5 3.5V12H3z" fill="white" fillOpacity="0.9" />
              <path d="M6 12V9h4v3" fill="white" fillOpacity="0.5" />
            </svg>
          </div>
          <span
            className="text-base font-semibold text-surface-900 tracking-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            EduSpace
          </span>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-surface-100 border border-surface-200">
          {['en', 'fr'].map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                import('../../i18n').then(({ default: i18n }) => i18n.changeLanguage(code));
              }}
              className="px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-all cursor-pointer text-surface-500 hover:text-surface-700 hover:bg-white"
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px]">
          {/*
           * backdrop-blur-sm intentionally removed.
           * backdrop-filter promotes the element to its own compositing layer
           * which makes it act as a containing block for fixed-position children,
           * trapping modals inside this card instead of the full viewport.
           * Opacity raised white/90 → white/95 to compensate visually.
           */}
          <div className="bg-white/95 border border-surface-200/80 rounded-[var(--radius-xl)] shadow-xl shadow-surface-200/60 p-8">
            <div className="flex gap-1 mb-8 p-1 bg-surface-100 rounded-[var(--radius-md)]">
              {(['login', 'register'] as AuthView[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`relative flex-1 py-2 text-sm font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer
                    ${view === v
                      ? 'bg-white text-surface-900 shadow-sm'
                      : 'text-surface-500 hover:text-surface-700'}`}
                >
                  {v === 'login' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {view === 'login' ? (
                <LoginForm
                  key="login"
                  onSuccess={handleAuthSuccess}
                  onGoogleNeedsProfile={handleGoogleNeedsProfile}
                  onForgotPassword={() => setShowForgot(true)}
                  onSwitchToRegister={() => setView('register')}
                />
              ) : (
                <RegisterForm
                  key="register"
                  onSuccess={handleAuthSuccess}
                  onSwitchToLogin={() => setView('login')}
                />
              )}
            </AnimatePresence>
          </div>

          <p className="text-center text-xs text-surface-400 mt-6">
            © {new Date().getFullYear()} EduSpace. All rights reserved.
          </p>
        </div>
      </main>

      {/*
       * ForgotPasswordModal owns the entire reset flow:
       *   email → send code → verify code → new password → done
       *
       * LoginForm has zero reset state. It calls onForgotPassword() which
       * sets showForgot=true here, opening this modal.
       */}
      <ForgotPasswordModal
        isOpen={showForgot}
        onClose={() => setShowForgot(false)}
      />

      {googleUser && (
        <GoogleCompleteProfileModal
          isOpen={true}
          user={googleUser}
          onComplete={handleProfileComplete}
        />
      )}
    </div>
  );
}