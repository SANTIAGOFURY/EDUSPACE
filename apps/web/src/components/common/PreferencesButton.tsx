// ─────────────────────────────────────────────────────────────────────────────
// components/PreferencesButton/PreferencesButton.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, Sun, Moon, Sparkles, Check } from 'lucide-react';
import { useTheme, type Theme, type Accent } from '../../context/ThemeContext';

// ── Config ────────────────────────────────────────────────────────────────────

const THEMES: { id: Theme; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'light',    label: 'Light',    icon: <Sun      size={13} />, desc: 'Clean & bright'   },
  { id: 'dark',     label: 'Dark',     icon: <Moon     size={13} />, desc: 'Easy on the eyes' },
  { id: 'midnight', label: 'Midnight', icon: <Sparkles size={13} />, desc: 'Deep & focused'   },
];

const ACCENTS: { id: Accent; label: string; light: string; dark: string }[] = [
  { id: 'indigo',  label: 'Indigo',  light: '#4f46e5', dark: '#818cf8' },
  { id: 'violet',  label: 'Violet',  light: '#7c3aed', dark: '#a78bfa' },
  { id: 'emerald', label: 'Emerald', light: '#059669', dark: '#34d399' },
  { id: 'rose',    label: 'Rose',    light: '#e11d48', dark: '#fb7185' },
  { id: 'amber',   label: 'Amber',   light: '#d97706', dark: '#fbbf24' },
  { id: 'sky',     label: 'Sky',     light: '#0284c7', dark: '#38bdf8' },
];

// ── Styles ────────────────────────────────────────────────────────────────────

const css = {
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 10px',
    borderRadius: 'var(--radius-md)',
    border: '1.5px solid var(--input-border)',
    background: 'var(--bg-card)',
    color: 'var(--text-muted)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    transition: 'border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
  } as React.CSSProperties,

  popup: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    right: 0,
    width: '252px',
    borderRadius: 'var(--radius-xl)',
    background: 'var(--popup-bg)',
    border: '1.5px solid var(--popup-border)',
    boxShadow: 'var(--popup-shadow)',
    overflow: 'hidden',
    zIndex: 200,
    fontFamily: 'var(--font-body)',
  } as React.CSSProperties,

  popupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
    padding: '12px 14px 10px',
    borderBottom: '1px solid var(--input-border)',
  } as React.CSSProperties,

  popupHeaderLabel: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.07em',
    textTransform: 'uppercase' as const,
  },

  section: {
    padding: '12px 14px',
    borderBottom: '1px solid var(--input-border)',
  } as React.CSSProperties,

  sectionLast: {
    padding: '12px 14px 14px',
  } as React.CSSProperties,

  sectionLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--text-subtle)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    marginBottom: '8px',
  } as React.CSSProperties,
} as const;

// ── ThemeChip ─────────────────────────────────────────────────────────────────

function ThemeChip({
  item,
  active,
  onClick,
}: {
  item: (typeof THEMES)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={item.desc}
      aria-pressed={active}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 4px',
        borderRadius: 'var(--radius-md)',
        border: '2px solid',
        borderColor: active ? 'var(--color-primary-500)' : 'var(--input-border)',
        background: active
          ? 'color-mix(in srgb, var(--color-primary-500) 10%, transparent)'
          : 'transparent',
        color: active ? 'var(--color-primary-600)' : 'var(--text-subtle)',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
      }}
    >
      <span style={{ lineHeight: 1 }}>{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );
}

// ── AccentSwatch ──────────────────────────────────────────────────────────────

function AccentSwatch({
  item,
  active,
  isDark,
  onClick,
}: {
  item: (typeof ACCENTS)[number];
  active: boolean;
  isDark: boolean;
  onClick: () => void;
}) {
  const color = isDark ? item.dark : item.light;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${item.label} accent${active ? ' (active)' : ''}`}
      aria-pressed={active}
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        background: color,
        border: active ? '3px solid var(--text-base)' : '3px solid transparent',
        outline: active ? `2.5px solid ${color}` : '2.5px solid transparent',
        outlineOffset: '1px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'transform 0.12s ease, outline-color 0.15s ease, border-color 0.15s ease',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!active) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.12)';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
      }}
    >
      {active && <Check size={11} color="#fff" strokeWidth={3.5} />}
    </button>
  );
}

// ── PreferencesButton ─────────────────────────────────────────────────────────

export function PreferencesButton() {
  const { theme, accent, setTheme, setAccent } = useTheme();
  const [open, setOpen] = useState(false);
  const containerRef    = useRef<HTMLDivElement>(null);
  const dialogId        = useId();
  const isDark          = theme !== 'light';

  const activeAccentColor = isDark
    ? ACCENTS.find(a => a.id === accent)?.dark
    : ACCENTS.find(a => a.id === accent)?.light;

  // ── Outside-click: native listener on the container node itself ────────────
  // We attach via useEffect on the DOM node directly so we can call
  // stopPropagation() before the document-level handler ever fires.
  // React synthetic events (onMouseDown={...}) run AFTER native listeners
  // on document, so they cannot stop native document listeners from firing.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const stopProp = (e: MouseEvent) => e.stopPropagation();
    container.addEventListener('mousedown', stopProp);
    return () => container.removeEventListener('mousedown', stopProp);
  }, []); // ← runs once, no dependency on `open` needed

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // ── Close on Escape ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: 'relative', zIndex: 20 }}>

      {/* ── Trigger ────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-label="Open preferences"
        aria-expanded={open}
        aria-controls={dialogId}
        aria-haspopup="dialog"
        style={{
          ...css.trigger,
          ...(open ? { borderColor: 'var(--color-primary-400)', color: 'var(--text-base)' } : {}),
        }}
        onMouseEnter={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--input-border-hover)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-base)';
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--input-border)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
          }
        }}
      >
        <SlidersHorizontal size={13} />
        <span style={{ letterSpacing: '0.01em' }}>Appearance</span>
        <span
          style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: activeAccentColor ?? '#4f46e5',
            flexShrink: 0,
            transition: 'background 0.25s ease',
          }}
          aria-hidden="true"
        />
      </button>

      {/* ── Popup ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            id={dialogId}
            role="dialog"
            aria-label="Appearance preferences"
            initial={{ opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1,    y: 0  }}
            exit={{    opacity: 0, scale: 0.96, y: -6  }}
            transition={{ duration: 0.17, ease: [0.4, 0, 0.2, 1] }}
            style={css.popup}
          >
            {/* Header */}
            <div style={css.popupHeader}>
              <SlidersHorizontal
                size={12}
                style={{ color: 'var(--color-primary-500)', flexShrink: 0 }}
              />
              <span style={css.popupHeaderLabel}>Appearance</span>
            </div>

            {/* ── Theme ─────────────────────────────────────────── */}
            <div style={css.section}>
              <p style={css.sectionLabel}>Theme</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {THEMES.map(t => (
                  <ThemeChip
                    key={t.id}
                    item={t}
                    active={theme === t.id}
                    onClick={() => setTheme(t.id)}
                  />
                ))}
              </div>
            </div>

            {/* ── Accent Color ───────────────────────────────────── */}
            <div style={css.sectionLast}>
              <p style={css.sectionLabel}>Accent color</p>
              <div style={{ display: 'flex', gap: '10px', marginBottom: '8px' }}>
                {ACCENTS.map(a => (
                  <AccentSwatch
                    key={a.id}
                    item={a}
                    active={accent === a.id}
                    isDark={isDark}
                    onClick={() => setAccent(a.id)}
                  />
                ))}
              </div>
              <p style={{
                fontSize: '11px',
                color: 'var(--text-subtle)',
                fontWeight: 500,
                letterSpacing: '0.02em',
                transition: 'color 0.2s ease',
              }}>
                {ACCENTS.find(a => a.id === accent)?.label}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}