import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingOverlay } from '../ui/LoadingOverlay';

type Props = { children: React.ReactNode };

export function RequireAuth({ children }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'checking' | 'ok' | 'fail'>('checking');
  const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || 'http://localhost:5000';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
        if (!mounted) return;
        if (res.ok) setStatus('ok');
        else {
          setStatus('fail');
          navigate('/login', { replace: true, state: { from: location.pathname } });
        }
      } catch {
        if (!mounted) return;
        setStatus('fail');
        navigate('/login', { replace: true, state: { from: location.pathname } });
      }
    })();
    return () => { mounted = false; };
  }, [API, navigate, location.pathname]);

  if (status === 'checking') return <LoadingOverlay text="Verificando sessão..." fullscreen />;
  if (status === 'ok') return <>{children}</>;
  return null;
}

