import { useEffect, useState } from 'react';

export type UserProfile = {
  id: string;
  name: string;
  email?: string;
  role: string;
  company_id: string;
  industry?: string;
};

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchProfile() {
      setLoading(true);
      setError(null);
      try {
        const url = `${import.meta.env.VITE_API_URL}/auth/me`;
        
        const res = await fetch(url, { credentials: 'include' });
        if (!mounted) return;
        
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
        } else {
          setError('Não autenticado');
          setProfile(null);
        }
      } catch (e: any) {
        if (!mounted) return;
        console.error('[useUserProfile] ❌ Error:', e);
        setError(e?.message || 'Erro ao carregar perfil');
        setProfile(null);
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
    return () => { mounted = false; };
  }, []);

  return { profile, loading, error };
}
