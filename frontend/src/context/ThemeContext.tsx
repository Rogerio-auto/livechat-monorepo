import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  registerUserTheme: (userId: string | null | undefined) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const DEFAULT_THEME: Theme = "dark";
const STORAGE_PREFIX = "sion:theme";
const LAST_THEME_KEY = `${STORAGE_PREFIX}:last`;

function readStoredTheme(key: string): Theme | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(key);
  if (stored === "light" || stored === "dark") return stored;
  return null;
}

function applyDocumentTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  // Sistema legado
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle("theme-dark", theme === "dark");
  document.documentElement.classList.toggle("theme-light", theme === "light");
  
  // Sistema Tailwind - CRÍTICO para dark mode funcionar
  document.documentElement.classList.toggle("dark", theme === "dark");
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  return (
    readStoredTheme(LAST_THEME_KEY) ??
    readStoredTheme(`${STORAGE_PREFIX}:default`) ??
    DEFAULT_THEME
  );
}

const INITIAL_THEME = getInitialTheme();

if (typeof document !== "undefined") {
  applyDocumentTheme(INITIAL_THEME);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [userKey, setUserKey] = useState<string>("default");

  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${userKey}`,
    [userKey],
  );

  const [theme, setThemeState] = useState<Theme>(() => INITIAL_THEME);

  useEffect(() => {
    applyDocumentTheme(theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = readStoredTheme(storageKey);
    if (stored) {
      setThemeState(stored);
      window.localStorage.setItem(LAST_THEME_KEY, stored);
    } else {
      window.localStorage.setItem(storageKey, theme);
      window.localStorage.setItem(LAST_THEME_KEY, theme);
    }
  }, [storageKey, theme]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = (event: StorageEvent) => {
      if (event.key !== storageKey || !event.newValue) return;
      if (event.newValue === theme) return;
      if (event.newValue === "dark" || event.newValue === "light") {
        setThemeState(event.newValue);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [storageKey, theme]);

  const persistTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, next);
        window.localStorage.setItem(LAST_THEME_KEY, next);
      }
    },
    [storageKey],
  );

  const setTheme = useCallback(
    (next: Theme) => {
      if (next !== "light" && next !== "dark") return;
      persistTheme(next);
    },
    [persistTheme],
  );

  const toggleTheme = useCallback(() => {
    persistTheme(theme === "dark" ? "light" : "dark");
  }, [persistTheme, theme]);

  const registerUserTheme = useCallback((userId: string | null | undefined) => {
    setUserKey(userId && userId.trim().length > 0 ? userId : "default");
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      toggleTheme,
      registerUserTheme,
    }),
    [theme, setTheme, toggleTheme, registerUserTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
