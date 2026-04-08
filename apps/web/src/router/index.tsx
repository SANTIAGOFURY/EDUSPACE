import { createBrowserRouter, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { ReactNode } from 'react';

import AuthPage from '../pages/auth/AuthPage';

import Home from '../pages/open/Home';
import About from '../pages/open/About';
import Contact from '../pages/open/Contact';
import Services from '../pages/open/Services';

import StudentLayout from '../pages/student/index';
import StudentHome from '../pages/student/StudentHome';
import MyCourses from '../pages/student/MyCourses';
import Quizzes from '../pages/student/Quizzes';
import Requests from '../pages/student/Requests';

import TeacherLayout from '../pages/teacher/index';
import Dashboard from '../pages/teacher/Dashboard';
import Courses from '../pages/teacher/Courses';
import Classes from '../pages/teacher/Classes';
import StudentManager from '../pages/teacher/tabs/StudentManager';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-50">
      <div className="w-6 h-6 rounded-full border-2 border-primary-600 border-t-transparent animate-spin" />
    </div>
  );
}

/**
 * Redirects signed-in users away from /auth.
 * Users with an incomplete profile are allowed through so the modal can render.
 */
function GuestGuard({ children }: { children: ReactNode }) {
  const { user, profile, loading, profileLoading } = useAuth();

  if (loading || profileLoading) return <PageLoader />;

  // Incomplete-profile Google users must stay on /auth to complete the modal
  if (user && profile && !profile.profileComplete) return <>{children}</>;

  // Fully authenticated → send to dashboard
  if (user) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

/**
 * Blocks unauthenticated users and users with an incomplete profile.
 */
function AuthGuard({ children }: { children: ReactNode }) {
  const { user, profile, loading, profileLoading } = useAuth();

  if (loading || profileLoading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;

  // Profile not yet written to Firestore (brief post-signup race) — wait
  if (!profile) return <PageLoader />;

  // Google user who hasn't finished the profile modal yet
  if (!profile.profileComplete) return <Navigate to="/auth" replace />;

  return <>{children}</>;
}

/**
 * Reads role from context and redirects to the correct area.
 * Profile is guaranteed to exist here because AuthGuard runs first.
 */
function DashboardRedirect() {
  const { profile } = useAuth();
  if (profile?.role === 'teacher') return <Navigate to="/teacher" replace />;
  return <Navigate to="/student" replace />;
}

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-surface-50">
      <span
        className="text-6xl font-semibold text-surface-200"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        404
      </span>
      <p className="text-surface-500 text-sm">Page not found</p>
      <a
        href="/home"
        className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
      >
        ← Back to home
      </a>
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/home" replace /> },

  { path: '/home',     element: <Home /> },
  { path: '/about',    element: <About /> },
  { path: '/contact',  element: <Contact /> },
  { path: '/services', element: <Services /> },

  // ForgotPasswordModal is rendered inside AuthPage — no separate route needed
  {
    path: '/auth',
    element: <GuestGuard><AuthPage /></GuestGuard>,
  },

  {
    path: '/dashboard',
    element: <AuthGuard><DashboardRedirect /></AuthGuard>,
  },

  {
    path: '/student',
    element: <AuthGuard><StudentLayout /></AuthGuard>,
    children: [
      { index: true,      element: <StudentHome /> },
      { path: 'courses',  element: <MyCourses /> },
      { path: 'quizzes',  element: <Quizzes /> },
      { path: 'requests', element: <Requests /> },
    ],
  },

  {
    path: '/teacher',
    element: <AuthGuard><TeacherLayout /></AuthGuard>,
    children: [
      { index: true,      element: <Dashboard /> },
      { path: 'courses',  element: <Courses /> },
      { path: 'classes',  element: <Classes /> },
      { path: 'students', element: <StudentManager /> },
    ],
  },

  { path: '*', element: <NotFound /> },
]);