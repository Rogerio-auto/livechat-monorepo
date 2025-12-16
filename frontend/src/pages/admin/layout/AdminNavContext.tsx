import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type AdminNavContextValue = {
  labels: Record<string, string>;
  setLabel: (segment: string, label: string | null) => void;
};

const AdminNavContext = createContext<AdminNavContextValue | null>(null);

export function AdminNavProvider({ children }: { children: React.ReactNode }) {
  const [labels, setLabels] = useState<Record<string, string>>({});

  const setLabel = useCallback((segment: string, label: string | null) => {
    if (!segment) return;
    setLabels((prev) => {
      if (label === null) {
        if (!(segment in prev)) return prev;
        const clone = { ...prev };
        delete clone[segment];
        return clone;
      }
      if (prev[segment] === label) return prev;
      return { ...prev, [segment]: label };
    });
  }, []);

  const value = useMemo<AdminNavContextValue>(() => ({ labels, setLabel }), [labels, setLabel]);

  return <AdminNavContext.Provider value={value}>{children}</AdminNavContext.Provider>;
}

export function useAdminNav() {
  const ctx = useContext(AdminNavContext);
  if (!ctx) {
    throw new Error('useAdminNav must be used within an AdminNavProvider');
  }
  return ctx;
}
