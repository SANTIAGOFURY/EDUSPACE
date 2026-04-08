import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, BookOpen, GraduationCap, TrendingUp,
  Clock, CheckCircle2, AlertCircle, ArrowUpRight,
} from 'lucide-react';
import StudentManager from './tabs/StudentManager';

type Tab = 'overview' | 'activity' | 'upcoming' | 'students';

const STATS = [
  { label: 'Total Students', value: '142', delta: '+8 this month',   icon: Users,         color: 'bg-blue-50    text-blue-600',    dot: 'bg-blue-500'    },
  { label: 'Active Classes', value: '6',   delta: '2 starting soon', icon: BookOpen,      color: 'bg-violet-50  text-violet-600',  dot: 'bg-violet-500'  },
  { label: 'Assignments',    value: '24',  delta: '5 ungraded',      icon: GraduationCap, color: 'bg-amber-50   text-amber-600',   dot: 'bg-amber-500'   },
  { label: 'Avg. Score',     value: '78%', delta: '+3% vs last week', icon: TrendingUp,   color: 'bg-emerald-50 text-emerald-600', dot: 'bg-emerald-500' },
];

const ACTIVITY = [
  { id: 1, type: 'submission', text: 'Amira B. submitted "Chapter 4 Quiz"',       time: '2 min ago',  status: 'new'  },
  { id: 2, type: 'grade',      text: 'You graded "Midterm Essay" for 12 students', time: '1 hr ago',   status: 'done' },
  { id: 3, type: 'message',    text: 'Youssef K. sent you a message',              time: '3 hr ago',   status: 'new'  },
  { id: 4, type: 'submission', text: 'Nadia M. submitted "Lab Report 3"',          time: 'Yesterday',  status: 'new'  },
  { id: 5, type: 'grade',      text: 'You graded "Pop Quiz #5" for 8 students',    time: 'Yesterday',  status: 'done' },
  { id: 6, type: 'message',    text: 'Hamid R. sent you a message',                time: '2 days ago', status: 'done' },
];

const UPCOMING = [
  { id: 1, title: 'Mathematics – Class 3B',          time: 'Today, 09:00',    type: 'class',    badge: 'bg-blue-50   text-blue-700'   },
  { id: 2, title: '"Chapter 5 Quiz" deadline',        time: 'Today, 23:59',    type: 'deadline', badge: 'bg-red-50    text-red-700'    },
  { id: 3, title: 'Physics – Class 2A',               time: 'Tomorrow, 11:00', type: 'class',    badge: 'bg-blue-50   text-blue-700'   },
  { id: 4, title: 'Parent–Teacher meeting',           time: 'Thu, 14:00',      type: 'meeting',  badge: 'bg-violet-50 text-violet-700' },
  { id: 5, title: '"Midterm Report" submission open', time: 'Fri, 08:00',      type: 'deadline', badge: 'bg-amber-50  text-amber-700'  },
];

const CLASSES = [
  { name: 'Mathematics 3B', students: 28, progress: 72, color: '#6366f1' },
  { name: 'Physics 2A',     students: 24, progress: 58, color: '#0ea5e9' },
  { name: 'Chemistry 1C',   students: 31, progress: 45, color: '#10b981' },
  { name: 'Biology 2B',     students: 26, progress: 83, color: '#f59e0b' },
];

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer whitespace-nowrap
        ${active ? 'text-primary-700' : 'text-surface-500 hover:text-surface-700'}`}
    >
      {children}
      {active && (
        <motion.div
          layoutId="teacher-dash-tab"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-600 rounded-full"
        />
      )}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeacherDashboard() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="p-5 lg:p-7 max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-xl font-semibold text-surface-900"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Good morning 👋
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Here's what's happening in your classes today.
          </p>
        </div>
        <span className="shrink-0 text-xs text-surface-400 mt-1">
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        </span>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white border border-surface-100 rounded-[var(--radius-lg)] p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-[var(--radius-md)] ${s.color.split(' ')[0]}`}>
                <s.icon size={15} className={s.color.split(' ')[1]} />
              </div>
              <ArrowUpRight size={13} className="text-surface-300" />
            </div>
            <p className="text-xl font-semibold text-surface-900 leading-none">{s.value}</p>
            <p className="text-xs text-surface-500 mt-1">{s.label}</p>
            <p className="text-[10px] text-surface-400 mt-1.5 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
              {s.delta}
            </p>
          </motion.div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white border border-surface-100 rounded-[var(--radius-lg)] overflow-hidden">

        {/* Tab bar */}
        <div className="flex border-b border-surface-100 px-4 overflow-x-auto">
          <TabBtn active={tab === 'overview'}  onClick={() => setTab('overview')}>Overview</TabBtn>
          <TabBtn active={tab === 'activity'}  onClick={() => setTab('activity')}>Recent Activity</TabBtn>
          <TabBtn active={tab === 'upcoming'}  onClick={() => setTab('upcoming')}>Upcoming</TabBtn>
          <TabBtn active={tab === 'students'}  onClick={() => setTab('students')}>
            <span className="flex items-center gap-1.5">
              <Users size={13} />
              Student Manager
            </span>
          </TabBtn>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >

            {/* ── Overview tab ── */}
            {tab === 'overview' && (
              <div className="p-5 space-y-5">
                <div>
                  <h3 className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-3">
                    Class progress
                  </h3>
                  <div className="space-y-3">
                    {CLASSES.map((cls) => (
                      <div key={cls.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: cls.color }}
                            />
                            <span className="text-sm font-medium text-surface-700">{cls.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-surface-400">{cls.students} students</span>
                            <span className="text-xs font-medium text-surface-700 w-8 text-right">
                              {cls.progress}%
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${cls.progress}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                            className="h-full rounded-full"
                            style={{ background: cls.color }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-3">
                    Quick actions
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'New assignment',    color: 'hover:bg-primary-50  hover:border-primary-200  hover:text-primary-700'  },
                      { label: 'Grade submissions', color: 'hover:bg-amber-50    hover:border-amber-200    hover:text-amber-700'    },
                      { label: 'Message students',  color: 'hover:bg-emerald-50  hover:border-emerald-200  hover:text-emerald-700'  },
                      { label: 'View schedule',     color: 'hover:bg-violet-50   hover:border-violet-200   hover:text-violet-700'   },
                    ].map((a) => (
                      <button
                        key={a.label}
                        className={`px-3 py-2.5 rounded-[var(--radius-md)] border border-surface-200
                                   text-xs font-medium text-surface-600 transition-all duration-150 cursor-pointer ${a.color}`}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Activity tab ── */}
            {tab === 'activity' && (
              <div className="divide-y divide-surface-50">
                {ACTIVITY.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors"
                  >
                    <div className="mt-0.5 shrink-0">
                      {item.status === 'new'
                        ? <AlertCircle size={15} className="text-primary-500" />
                        : <CheckCircle2 size={15} className="text-surface-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm leading-snug ${
                        item.status === 'new' ? 'text-surface-800 font-medium' : 'text-surface-500'
                      }`}>
                        {item.text}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Clock size={11} className="text-surface-300" />
                      <span className="text-[11px] text-surface-400 whitespace-nowrap">{item.time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Upcoming tab ── */}
            {tab === 'upcoming' && (
              <div className="divide-y divide-surface-50">
                {UPCOMING.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{item.title}</p>
                      <p className="text-xs text-surface-400 mt-0.5 flex items-center gap-1">
                        <Clock size={11} />
                        {item.time}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[10px] font-medium px-2 py-1 rounded-full ${item.badge}`}>
                      {item.type}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* ── Student Manager tab ── */}
            {tab === 'students' && <StudentManager />}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}