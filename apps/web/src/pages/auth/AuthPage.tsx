import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { LoginForm } from '../../features/auth/LoginForm';
import { RegisterForm } from '../../features/auth/RegisterForm';
import { ForgotPasswordModal } from '../../features/auth/ForgotPasswordModal';
import { GoogleCompleteProfileModal } from '../../features/auth/GoogleCompleteProfileModal';
import { PreferencesButton } from '../../components/common/PreferencesButton';
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

  const completingProfileRef = useRef(false);

  const isBusy = loading || profileLoading;

  useEffect(() => {
    if (isBusy) return;
    if (!redirectChecked) return;
    if (!user || !profile) return;
    if (!profile.profileComplete) return;
    if (googleUser) return;
    navigate('/dashboard', { replace: true });
  }, [isBusy, redirectChecked, user, profile, googleUser, navigate]);

  useEffect(() => {
    if (!completingProfileRef.current) return;
    if (isBusy) return;
    if (!profile?.profileComplete) return;
    completingProfileRef.current = false;
    setGoogleUser(null);
    navigate('/dashboard', { replace: true });
  }, [profile?.profileComplete, isBusy, navigate]);

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

  useEffect(() => {
    if (!redirectChecked) return;
    if (isBusy) return;
    if (completingProfileRef.current) return;
    if (googleUser) return;
    if (!user || !profile) return;
    if (profile.profileComplete) return;
    setGoogleUser(user);
  }, [redirectChecked, isBusy, user, profile, googleUser]);

  const handleAuthSuccess        = () => navigate('/dashboard', { replace: true });
  const handleGoogleNeedsProfile = (firebaseUser: User) => {
    completingProfileRef.current = false;
    setGoogleUser(firebaseUser);
  };
  const handleProfileComplete = () => { completingProfileRef.current = true; };

  return (
    /*
     * IMPORTANT: No element in this tree may use backdrop-filter/blur,
     * will-change, transform, or filter — those CSS properties create a new
     * stacking/compositing context that traps `position: fixed` descendants
     * (modals) inside the element's bounds instead of covering the full viewport.
     */
    <div className="auth-bg noise-bg min-h-screen relative flex flex-col">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4">

        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 flex items-center justify-center shadow-sm"
            style={{ borderRadius: 'var(--radius-md)', background: 'var(--color-primary-600)' }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 12V6.5L8 3l5 3.5V12H3z" fill="white" fillOpacity="0.9" />
              <path d="M6 12V9h4v3" fill="white" fillOpacity="0.5" />
            </svg>
          </div>
          <span
            className="text-base font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-base)' }}
          >
            EduSpace
          </span>
        </div>

        {/* Preferences — replaces old language toggle */}
        <PreferencesButton />
      </header>

      {/* ── Main ───────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px]">

          {/*
           * backdrop-blur-sm intentionally removed from this card.
           * backdrop-filter creates a compositing context that traps
           * position:fixed children (modals) inside the card's bounds.
           */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1.5px solid var(--bg-card-border)',
              borderRadius: 'var(--radius-xl)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)',
              padding: '32px',
              transition: 'background 0.3s ease, border-color 0.3s ease',
            }}
          >
            {/* Tab switcher */}
            <div
              style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '32px',
                padding: '4px',
                background: 'var(--color-surface-100)',
                borderRadius: 'var(--radius-md)',
                transition: 'background 0.3s ease',
              }}
            >
              {(['login', 'register'] as AuthView[]).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  style={{
                    flex: 1,
                    padding: '8px 0',
                    fontSize: '13.5px',
                    fontWeight: 500,
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-body)',
                    transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                    background: view === v ? 'var(--bg-card)' : 'transparent',
                    color: view === v ? 'var(--text-base)' : 'var(--text-muted)',
                    boxShadow: view === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  {v === 'login' ? t('auth.signIn') : t('auth.signUp')}
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

          <p
            className="text-center text-xs mt-6"
            style={{ color: 'var(--text-subtle)' }}
          >
            © {new Date().getFullYear()} EduSpace. All rights reserved.
          </p>
        </div>
      </main>

      {/* ── Modals ─────────────────────────────────────────────── */}
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