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
type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  theme: Theme;
  preference: ThemePreference;
  setTheme: (theme: Theme) => void;
  setPreference: (pref: ThemePreference) => void;
  toggleTheme: () => void;
  registerUserTheme: (userId: string | null | undefined) => void;
  syncWithServer: () => Promise<void>;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_PREFIX = "sion:theme";
const LAST_THEME_KEY = `${STORAGE_PREFIX}:last`;
const PREFERENCE_KEY = `${STORAGE_PREFIX}:preference`;

// Detecta preferência do sistema operacional
function getSystemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(key: string): Theme | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(key);
  if (stored === "light" || stored === "dark") return stored;
  return null;
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(PREFERENCE_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  return "system";
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
  if (typeof window === "undefined") return "light";
  
  // 1. Verificar preferência salva
  const preference = readStoredPreference();
  
  // 2. Se preferência é "system", usar tema do SO
  if (preference === "system") {
    return getSystemTheme();
  }
  
  // 3. Se não, usar último tema ou a preferência específica
  return (
    readStoredTheme(LAST_THEME_KEY) ??
    preference
  );
}

const INITIAL_THEME = getInitialTheme();

if (typeof document !== "undefined") {
  applyDocumentTheme(INITIAL_THEME);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [userKey, setUserKey] = useState<string>("default");
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredPreference());

  const storageKey = useMemo(
    () => `${STORAGE_PREFIX}:${userKey}`,
    [userKey],
  );

  const [theme, setThemeState] = useState<Theme>(() => INITIAL_THEME);

  // Aplicar tema no documento
  useEffect(() => {
    applyDocumentTheme(theme);
  }, [theme]);

  // Observar mudanças na preferência do sistema (quando preference = "system")
  useEffect(() => {
    if (preference !== "system") return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      const systemTheme = e.matches ? "dark" : "light";
      setThemeState(systemTheme);
      applyDocumentTheme(systemTheme);
    };
    
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [preference]);

  // Sincronizar tema com localStorage
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

  // Sincronizar entre abas
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sync = (event: StorageEvent) => {
      if (event.key === LAST_THEME_KEY && event.newValue) {
        if (event.newValue === "dark" || event.newValue === "light") {
          setThemeState(event.newValue);
        }
      }
      if (event.key === PREFERENCE_KEY && event.newValue) {
        if (event.newValue === "light" || event.newValue === "dark" || event.newValue === "system") {
          setPreferenceState(event.newValue);
          // Se mudou para system, aplicar tema do SO
          if (event.newValue === "system") {
            const systemTheme = getSystemTheme();
            setThemeState(systemTheme);
          }
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

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
      // Ao setar tema manualmente, mudar preferência para esse tema específico
      setPreferenceState(next);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(PREFERENCE_KEY, next);
      }
    },
    [persistTheme],
  );

  const setPreference = useCallback(async (pref: ThemePreference) => {
    setPreferenceState(pref);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PREFERENCE_KEY, pref);
    }
    
    // Se mudar para "system", aplicar tema do SO imediatamente
    if (pref === "system") {
      const systemTheme = getSystemTheme();
      persistTheme(systemTheme);
    } else {
      // Se mudar para light/dark específico, aplicar esse tema
      persistTheme(pref);
    }

    // Salvar no servidor
    try {
      const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";
      await fetch(`${API}/auth/me/theme`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme_preference: pref }),
      });
    } catch (error) {
      console.error("Failed to save theme preference to server:", error);
    }
  }, [persistTheme]);

  const toggleTheme = useCallback(async () => {
    const next = theme === "dark" ? "light" : "dark";
    persistTheme(next);
    setPreferenceState(next); // Ao alternar, preferência fica específica
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PREFERENCE_KEY, next);
    }

    // Salvar no servidor
    try {
      const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";
      const devCompany = (import.meta.env.VITE_DEV_COMPANY_ID as string | undefined)?.trim();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (import.meta.env.DEV && devCompany) headers["X-Company-Id"] = devCompany;
      await fetch(`${API}/auth/me/theme`, {
        method: "PATCH",
        credentials: "include",
        headers,
        body: JSON.stringify({ theme_preference: next }),
      });
    } catch (error) {
      console.error("Failed to save theme preference to server:", error);
    }
  }, [persistTheme, theme]);

  const registerUserTheme = useCallback((userId: string | null | undefined) => {
    setUserKey(userId && userId.trim().length > 0 ? userId : "default");
  }, []);

  const syncWithServer = useCallback(async () => {
    try {
      const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";
      const devCompany = (import.meta.env.VITE_DEV_COMPANY_ID as string | undefined)?.trim();
      const baseHeaders: Record<string, string> | undefined =
        import.meta.env.DEV && devCompany ? { "X-Company-Id": devCompany } : undefined;
      
      // 1. Buscar preferência do servidor
      const meRes = await fetch(`${API}/auth/me`, { credentials: "include", headers: baseHeaders });
      if (meRes.ok) {
        const userData = await meRes.json();
        if (userData.theme_preference) {
          setPreference(userData.theme_preference as ThemePreference);
        }
      }
      
      // 2. Salvar preferência atual no servidor
      if (preference !== "system") {
        const patchHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (baseHeaders?.["X-Company-Id"]) patchHeaders["X-Company-Id"] = baseHeaders["X-Company-Id"];
        await fetch(`${API}/auth/me/theme`, {
          method: "PATCH",
          credentials: "include",
          headers: patchHeaders,
          body: JSON.stringify({ theme_preference: preference }),
        });
      }
    } catch (error) {
      console.error("Failed to sync theme with server:", error);
    }
  }, [preference, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      preference,
      setTheme,
      setPreference,
      toggleTheme,
      registerUserTheme,
      syncWithServer,
    }),
    [theme, preference, setTheme, setPreference, toggleTheme, registerUserTheme, syncWithServer],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
