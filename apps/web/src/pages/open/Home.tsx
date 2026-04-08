import { useNavigate } from 'react-router-dom';
import { motion ,type Variants } from 'framer-motion';
import { ArrowRight, BookOpen, Users, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: "easeOut",
    },
  }),
};

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Rich Courses',
    desc: 'Interactive lessons, quizzes, and structured learning paths.',
  },
  {
    icon: Users,
    title: 'Live Classes',
    desc: 'Real-time sessions with your teachers and classmates.',
  },
  {
    icon: Zap,
    title: 'Instant Feedback',
    desc: 'AI-powered grading and progress tracking in real time.',
  },
];

export default function Home() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const isFr = i18n.language?.startsWith('fr');

  return (
    <div className="min-h-screen bg-surface-50 auth-bg noise-bg flex flex-col overflow-hidden">

      {/* ── Nav ── */}
      <header className="relative z-10 flex items-center justify-between px-6 md:px-10 py-5">
        {/* Logo */}
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

        <div className="flex items-center gap-3">
          {/* Inline language switcher — no external import needed */}
          <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-surface-100 border border-surface-200">
            {['en', 'fr'].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => i18n.changeLanguage(code)}
                className={`relative px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-all cursor-pointer
                  ${i18n.language?.startsWith(code)
                    ? 'bg-white text-surface-900 shadow-sm'
                    : 'text-surface-500 hover:text-surface-700'
                  }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate('/auth')}
            className="px-4 py-2 rounded-[var(--radius-md)] text-sm font-medium text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer"
          >
            {isFr ? 'Se connecter' : 'Sign in'}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-16 md:py-24">

        {/* Badge */}
        <motion.div
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-xs font-medium mb-8"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse" />
          {isFr ? "Plateforme d'apprentissage nouvelle génération" : 'Next-generation learning platform'}
        </motion.div>

        {/* Headline */}
        <motion.h1
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-4xl md:text-6xl font-semibold text-surface-900 tracking-tight leading-[1.1] max-w-2xl mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {isFr
            ? <><span>Apprenez plus vite,</span><br /><span className="text-primary-600">ensemble.</span></>
            : <><span>Learn faster,</span><br /><span className="text-primary-600">together.</span></>
          }
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="text-base md:text-lg text-surface-500 max-w-md mb-10 leading-relaxed"
        >
          {isFr
            ? 'EduSpace réunit étudiants et enseignants dans un espace collaboratif moderne.'
            : 'EduSpace brings students and teachers together in one modern, collaborative space.'
          }
        </motion.p>

        {/* CTAs */}
        <motion.div
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="flex flex-col sm:flex-row items-center gap-3"
        >
          <button
            onClick={() => navigate('/auth')}
            className="group flex items-center gap-2 px-6 py-3 rounded-[var(--radius-md)] bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium shadow-sm hover:shadow-md transition-all duration-150 cursor-pointer"
          >
            {isFr ? 'Commencer gratuitement' : 'Get started free'}
            <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform duration-150" />
          </button>

          <button
            onClick={() => navigate('/about')}
            className="px-6 py-3 rounded-[var(--radius-md)] text-sm font-medium text-surface-600 hover:text-surface-900 hover:bg-surface-100 transition-all duration-150 cursor-pointer"
          >
            {isFr ? 'En savoir plus' : 'Learn more'}
          </button>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-20 w-full max-w-3xl"
        >
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-white/80 backdrop-blur-sm border border-surface-200/80 rounded-[var(--radius-lg)] p-5 text-left hover:shadow-md hover:border-surface-300 transition-all duration-200"
            >
              <div className="w-9 h-9 rounded-[var(--radius-md)] bg-primary-50 flex items-center justify-center mb-3">
                <Icon size={18} className="text-primary-600" />
              </div>
              <h3
                className="text-sm font-semibold text-surface-900 mb-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {title}
              </h3>
              <p className="text-xs text-surface-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-6 text-xs text-surface-400">
        © {new Date().getFullYear()} EduSpace. All rights reserved.
      </footer>
    </div>
  );
}