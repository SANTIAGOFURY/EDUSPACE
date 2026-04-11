import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Theme  = 'light' | 'dark' | 'midnight';
export type Accent = 'indigo' | 'violet' | 'emerald' | 'rose' | 'amber' | 'sky';

interface ThemeContextValue {
  theme:     Theme;
  accent:    Accent;
  setTheme:  (t: Theme)  => void;
  setAccent: (a: Accent) => void;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

const KEYS = { theme: 'edu:theme', accent: 'edu:accent' } as const;

function readStorage<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const val = localStorage.getItem(key) as T | null;
    return val && (allowed as readonly string[]).includes(val) ? val : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* quota / private mode */ }
}

// ── Apply to DOM ──────────────────────────────────────────────────────────────

function applyTheme(theme: Theme, accent: Accent): void {
  const html = document.documentElement;
  html.setAttribute('data-theme',  theme);
  html.setAttribute('data-accent', accent);
}

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeCtx = createContext<ThemeContextValue | undefined>(undefined);

// ── Provider ──────────────────────────────────────────────────────────────────

const THEMES:  readonly Theme[]  = ['light', 'dark', 'midnight'];
const ACCENTS: readonly Accent[] = ['indigo', 'violet', 'emerald', 'rose', 'amber', 'sky'];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme,  setThemeState]  = useState<Theme>( () => readStorage(KEYS.theme,  'light',  THEMES));
  const [accent, setAccentState] = useState<Accent>(() => readStorage(KEYS.accent, 'indigo', ACCENTS));

  // Sync DOM on mount + whenever values change
  useEffect(() => { applyTheme(theme, accent); }, [theme, accent]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    writeStorage(KEYS.theme, t);
  }, []);

  const setAccent = useCallback((a: Accent) => {
    setAccentState(a);
    writeStorage(KEYS.accent, a);
  }, []);

  return (
    <ThemeCtx.Provider value={{ theme, accent, setTheme, setAccent }}>
      {children}
    </ThemeCtx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}