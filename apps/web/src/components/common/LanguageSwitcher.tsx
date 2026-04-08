import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const current = i18n.language?.slice(0, 2) ?? 'en';

  return (
    <div className="flex items-center gap-1 p-1 rounded-[var(--radius-md)] bg-surface-100 border border-surface-200">
      {LANGS.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => i18n.changeLanguage(code)}
          className="relative px-3 py-1 text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer"
        >
          {current === code && (
            <motion.span
              layoutId="lang-pill"
              className="absolute inset-0 bg-white rounded-[var(--radius-sm)] shadow-sm"
              transition={{ type: 'spring', bounce: 0.25, duration: 0.35 }}
            />
          )}
          <span className={`relative z-10 ${current === code ? 'text-surface-900' : 'text-surface-500'}`}>
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}