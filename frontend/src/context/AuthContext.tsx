import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UserProfile = {
  id: string;
  email: string;
  phone?: string | null;
  requires_phone_setup?: boolean;
  role?: string | null;
};

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true);
      const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";
      const devCompany = (import.meta.env.VITE_DEV_COMPANY_ID as string | undefined)?.trim();
      const headers = devCompany && import.meta.env.DEV ? { 'X-Company-Id': devCompany } : undefined;
      
      const res = await fetch(`${API}/auth/me`, { credentials: 'include', headers });
      
      if (res.ok) {
        const profile = await res.json();
        setUser(profile);
        setError(null);
        return profile;
      } else {
        setUser(null);
        setError('Not authenticated');
        return null;
      }
    } catch (err: any) {
      console.error('Error fetching user:', err);
      setUser(null);
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const logout = useCallback(() => {
    setUser(null);
    // Aqui você pode adicionar a lógica de logout do backend se necessário
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, refreshUser: fetchUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
