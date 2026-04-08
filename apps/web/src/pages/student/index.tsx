import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  BookOpen,
  ClipboardList,
  TrendingUp,
  CalendarDays,
  MessageSquare,
  Library,
  LogOut,
  Menu,
  X,
  Bell,
  ChevronRight,
  GraduationCap,
} from 'lucide-react';
import { logOut } from '../../services/auth';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { to: '/student',           label: 'Portal',      icon: LayoutDashboard, end: true },
  { to: '/student/courses',   label: 'My Courses',  icon: BookOpen ,end: false},
  { to: '/student/quizzes',   label: 'Assignments', icon: ClipboardList,end: false },
  { to: '/student/progress',  label: 'Progress',    icon: TrendingUp,end: false },
  { to: '/student/schedule',  label: 'Schedule',    icon: CalendarDays,end: false },
  { to: '/student/messages',  label: 'Messages',    icon: MessageSquare,end: false },
  { to: '/student/resources', label: 'Resources',   icon: Library,end: false },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentLayout() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut]   = useState(false);

  const activeLabel =
    NAV_ITEMS.find((n) =>
      n.end ? location.pathname === n.to : location.pathname.startsWith(n.to),
    )?.label ?? 'Portal';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logOut();
      toast.success('Signed out successfully');
      navigate('/auth', { replace: true });
    } catch {
      toast.error('Failed to sign out. Please try again.');
      setLoggingOut(false);
    }
  };

  const displayName = user?.displayName ?? user?.email ?? 'Student';
  const initials    = displayName
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ─── Sidebar content ──────────────────────────────────────────────────────

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="px-5 pt-6 pb-5 border-b border-surface-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shrink-0">
            <GraduationCap size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900 leading-tight"
               style={{ fontFamily: 'var(--font-display)' }}>
              EduPortal
            </p>
            <p className="text-[10px] text-emerald-600 font-medium tracking-wide uppercase">
              Student
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `group flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-sm
               font-medium transition-all duration-150 cursor-pointer
               ${isActive
                 ? 'bg-emerald-50 text-emerald-700'
                 : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
               }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={16}
                  className={isActive ? 'text-emerald-600' : 'text-surface-400 group-hover:text-surface-600'}
                />
                <span className="flex-1">{label}</span>
                {isActive && (
                  <motion.div
                    layoutId="student-nav-indicator"
                    className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      <div className="px-3 pb-5 pt-3 border-t border-surface-100 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)]">
          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="text-xs font-semibold text-emerald-700">{initials}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-surface-900 truncate">{displayName}</p>
            <p className="text-[10px] text-surface-400 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)]
                     text-sm font-medium text-surface-500 hover:bg-error-50 hover:text-error-600
                     transition-all duration-150 cursor-pointer disabled:opacity-50 group"
        >
          <LogOut size={16} className="group-hover:text-error-500 transition-colors" />
          {loggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-surface-50 overflow-hidden">

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 shrink-0 bg-white border-r border-surface-100 h-full">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-surface-900/40 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              key="sidebar"
              initial={{ x: -224 }}
              animate={{ x: 0 }}
              exit={{ x: -224 }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              className="fixed top-0 left-0 w-56 h-full bg-white border-r border-surface-100 z-50 lg:hidden"
            >
              <div className="absolute top-4 right-3">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="p-1.5 rounded-[var(--radius-md)] hover:bg-surface-100 text-surface-500 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">

        {/* Top bar */}
        <header className="h-14 shrink-0 bg-white border-b border-surface-100 flex items-center px-4 gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-[var(--radius-md)] hover:bg-surface-100 text-surface-500 cursor-pointer"
          >
            <Menu size={18} />
          </button>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-surface-400 hidden sm:inline">Student</span>
            <ChevronRight size={13} className="text-surface-300 hidden sm:inline" />
            <span className="font-medium text-surface-900">{activeLabel}</span>
          </div>

          <div className="flex-1" />

          <button className="relative p-2 rounded-[var(--radius-md)] hover:bg-surface-100 text-surface-500 cursor-pointer">
            <Bell size={17} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </button>

          <div className="hidden sm:flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full object-cover" />
              ) : (
                <span className="text-[10px] font-semibold text-emerald-700">{initials}</span>
              )}
            </div>
            <span className="text-xs font-medium text-surface-700 max-w-[120px] truncate">
              {displayName}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}