import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../context/AuthContext';
import {
  BookOpen, ClipboardList, TrendingUp,
  Clock, CheckCircle2, Circle, ArrowUpRight,
  Flame, Star,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'courses' | 'assignments' | 'progress';

// ─── Mock data ────────────────────────────────────────────────────────────────

const STATS = [
  { label: 'Courses enrolled', value: '5',   icon: BookOpen,     bg: 'bg-blue-50',    text: 'text-blue-600'   },
  { label: 'Assignments due',  value: '3',   icon: ClipboardList,bg: 'bg-amber-50',   text: 'text-amber-600'  },
  { label: 'Avg. grade',       value: '82%', icon: Star,         bg: 'bg-violet-50',  text: 'text-violet-600' },
  { label: 'Day streak',       value: '7',   icon: Flame,        bg: 'bg-red-50',     text: 'text-red-600'    },
];

const COURSES = [
  { id: 1, name: 'Mathematics',    teacher: 'Mr. Benali',   progress: 68, grade: 'A-', color: '#6366f1', next: 'Chapter 7 – Integrals'   },
  { id: 2, name: 'Physics',        teacher: 'Ms. Alaoui',   progress: 52, grade: 'B+', color: '#0ea5e9', next: 'Lab report due Friday'     },
  { id: 3, name: 'Chemistry',      teacher: 'Mr. Tazi',     progress: 41, grade: 'B',  color: '#10b981', next: 'Quiz tomorrow'             },
  { id: 4, name: 'French Lit.',    teacher: 'Ms. Chraibi',  progress: 79, grade: 'A',  color: '#f59e0b', next: 'Essay submission open'     },
  { id: 5, name: 'History',        teacher: 'Mr. Hassani',  progress: 88, grade: 'A+', color: '#ec4899', next: 'Chapter 12 reading'        },
];

const ASSIGNMENTS = [
  { id: 1, title: 'Chapter 7 Quiz',     course: 'Mathematics', due: 'Today, 23:59',   status: 'pending', urgent: true  },
  { id: 2, title: 'Lab Report 3',       course: 'Physics',     due: 'Tomorrow, 18:00',status: 'pending', urgent: false },
  { id: 3, title: 'Essay: Voltaire',    course: 'French Lit.', due: 'Fri, 20:00',     status: 'pending', urgent: false },
  { id: 4, title: 'Chapter 5 Quiz',     course: 'Chemistry',   due: 'Mon, 09:00',     status: 'submitted',urgent: false },
  { id: 5, title: 'WWII Timeline',      course: 'History',     due: 'Last week',       status: 'graded',  urgent: false },
  { id: 6, title: 'Equations Worksheet',course: 'Mathematics', due: 'Last week',       status: 'graded',  urgent: false },
];

const PROGRESS_SUBJECTS = [
  { name: 'Mathematics', scores: [72, 65, 80, 78, 88, 91], avg: 79, color: '#6366f1' },
  { name: 'Physics',     scores: [60, 70, 68, 75, 72, 80], avg: 71, color: '#0ea5e9' },
  { name: 'Chemistry',   scores: [55, 62, 70, 65, 72, 74], avg: 66, color: '#10b981' },
  { name: 'French Lit.', scores: [82, 85, 88, 90, 87, 92], avg: 87, color: '#f59e0b' },
  { name: 'History',     scores: [90, 88, 92, 95, 91, 96], avg: 92, color: '#ec4899' },
];

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer
        ${active ? 'text-emerald-700' : 'text-surface-500 hover:text-surface-700'}`}
    >
      {children}
      {active && (
        <motion.div
          layoutId="student-portal-tab"
          className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 rounded-full"
        />
      )}
    </button>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StudentHome() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('courses');

  const firstName = user?.displayName?.split(' ')[0] ?? 'Student';

  return (
    <div className="p-5 lg:p-7 max-w-5xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-surface-900"
              style={{ fontFamily: 'var(--font-display)' }}>
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-sm text-surface-500 mt-0.5">
            You have 3 assignments due this week. Keep it up!
          </p>
        </div>
        <span className="shrink-0 text-xs text-surface-400 mt-1">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="bg-white border border-surface-100 rounded-[var(--radius-lg)] p-4"
          >
            <div className={`w-8 h-8 rounded-[var(--radius-md)] ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon size={15} className={s.text} />
            </div>
            <p className="text-xl font-semibold text-surface-900 leading-none">{s.value}</p>
            <p className="text-xs text-surface-500 mt-1">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* ── Tab panel ── */}
      <div className="bg-white border border-surface-100 rounded-[var(--radius-lg)] overflow-hidden">
        <div className="flex border-b border-surface-100 px-4">
          <TabBtn active={tab === 'courses'}     onClick={() => setTab('courses')}>My Courses</TabBtn>
          <TabBtn active={tab === 'assignments'} onClick={() => setTab('assignments')}>Assignments</TabBtn>
          <TabBtn active={tab === 'progress'}    onClick={() => setTab('progress')}>Progress</TabBtn>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >

            {/* ── Courses tab ── */}
            {tab === 'courses' && (
              <div className="divide-y divide-surface-50">
                {COURSES.map((course) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-surface-50 transition-colors cursor-pointer group"
                  >
                    {/* Color bar */}
                    <div
                      className="w-1 h-10 rounded-full shrink-0"
                      style={{ background: course.color }}
                    />

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-surface-900">{course.name}</p>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-100 text-surface-500">
                          {course.grade}
                        </span>
                      </div>
                      <p className="text-xs text-surface-400">{course.teacher}</p>
                    </div>

                    {/* Progress */}
                    <div className="hidden sm:block w-28">
                      <div className="flex justify-between mb-1">
                        <span className="text-[10px] text-surface-400">Progress</span>
                        <span className="text-[10px] font-medium text-surface-600">{course.progress}%</span>
                      </div>
                      <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${course.progress}%`, background: course.color }}
                        />
                      </div>
                    </div>

                    {/* Next */}
                    <div className="hidden lg:block text-right max-w-[140px]">
                      <p className="text-[11px] text-surface-400 leading-snug">{course.next}</p>
                    </div>

                    <ArrowUpRight
                      size={14}
                      className="text-surface-300 group-hover:text-surface-500 transition-colors shrink-0"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* ── Assignments tab ── */}
            {tab === 'assignments' && (
              <div className="divide-y divide-surface-50">
                {ASSIGNMENTS.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors"
                  >
                    {/* Status icon */}
                    <div className="shrink-0">
                      {a.status === 'graded'    && <CheckCircle2 size={16} className="text-emerald-500" />}
                      {a.status === 'submitted' && <CheckCircle2 size={16} className="text-blue-400" />}
                      {a.status === 'pending'   && <Circle       size={16} className={a.urgent ? 'text-red-400' : 'text-surface-300'} />}
                    </div>

                    {/* Title + course */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate
                        ${a.status !== 'pending' ? 'text-surface-400 line-through' : 'text-surface-800'}`}>
                        {a.title}
                      </p>
                      <p className="text-xs text-surface-400">{a.course}</p>
                    </div>

                    {/* Due / status */}
                    <div className="text-right shrink-0">
                      {a.status === 'pending' && (
                        <span className={`text-[11px] font-medium flex items-center gap-1
                          ${a.urgent ? 'text-red-500' : 'text-surface-400'}`}>
                          <Clock size={11} />
                          {a.due}
                        </span>
                      )}
                      {a.status === 'submitted' && (
                        <span className="text-[11px] font-medium text-blue-500">Submitted</span>
                      )}
                      {a.status === 'graded' && (
                        <span className="text-[11px] font-medium text-emerald-500">Graded</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Progress tab ── */}
            {tab === 'progress' && (
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROGRESS_SUBJECTS.map((sub) => (
                    <div key={sub.name} className="border border-surface-100 rounded-[var(--radius-md)] p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: sub.color }} />
                          <span className="text-sm font-medium text-surface-700">{sub.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-surface-900">{sub.avg}%</span>
                      </div>

                      {/* Mini sparkline — last 6 scores as bars */}
                      <div className="flex items-end gap-1 h-10">
                        {sub.scores.map((score, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${(score / 100) * 40}px` }}
                            transition={{ delay: i * 0.05, duration: 0.4, ease: 'easeOut' }}
                            className="flex-1 rounded-sm"
                            style={{ background: i === sub.scores.length - 1 ? sub.color : `${sub.color}40` }}
                          />
                        ))}
                      </div>
                      <p className="text-[10px] text-surface-400 mt-1.5">Last 6 assessments</p>
                    </div>
                  ))}
                </div>

                {/* Overall GPA strip */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-[var(--radius-md)] px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-emerald-700">Overall average</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">Across all 5 subjects this semester</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-semibold text-emerald-700">82%</p>
                    <p className="text-[10px] text-emerald-500 flex items-center gap-0.5 justify-end">
                      <TrendingUp size={11} /> +4% this month
                    </p>
                  </div>
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}