import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { OnboardingModal } from '../onboarding/OnboardingModal';
import { useOnboardingStatus } from '../../hooks/useOnboardingStatus';

type Props = {
  children: React.ReactNode;
  roles?: string[];
};

type UserProfile = {
  id: string;
  email: string;
  phone?: string | null;
  requires_phone_setup?: boolean;
  role?: string | null;
};

export function RequireAuth({ children, roles }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [status, setStatus] = useState<'checking' | 'ok' | 'fail'>('checking');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [roleAllowed, setRoleAllowed] = useState(true);
  const { needsOnboarding, loading: onboardingLoading, markCompleted } = useOnboardingStatus();
  const rolesKey = roles?.join('|') ?? '';
  const normalizedRoles = useMemo(() => (roles ? roles.map((role) => role.toUpperCase()) : []), [rolesKey]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Usar VITE_API_URL para garantir que funciona em produção
        const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";
        const devCompany = (import.meta.env.VITE_DEV_COMPANY_ID as string | undefined)?.trim();
        const headers = devCompany && import.meta.env.DEV ? { 'X-Company-Id': devCompany } : undefined;
        const res = await fetch(`${API}/auth/me`, { credentials: 'include', headers });
        if (!mounted) return;
        if (res.ok) {
          const profile = await res.json();
          setUserProfile(profile);
          const userRole = String(profile?.role ?? '').toUpperCase();
          const allowed = normalizedRoles.length === 0 || normalizedRoles.includes(userRole);
          setRoleAllowed(allowed);
          if (!allowed) {
            setStatus('ok');
            navigate('/dashboard', { replace: true });
            return;
          }
          
          // Se precisa configurar telefone e não está na página de perfil, redirecionar
          if (profile.requires_phone_setup && location.pathname !== '/perfil') {
            navigate('/perfil', { replace: true, state: { requiresPhone: true } });
            return;
          }
          
          setStatus('ok');
        } else {
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
  }, [navigate, location.pathname, normalizedRoles]);

  const handleOnboardingComplete = () => {
    markCompleted();
    // Recarregar a página para aplicar configurações
    window.location.reload();
  };

  if (status === 'checking' || onboardingLoading) {
    return <LoadingOverlay text="Verificando sessão..." fullscreen />;
  }
  
  if (status === 'ok') {
    if (!roleAllowed) {
      return null;
    }
    return (
      <>
        {/* Modal de onboarding obrigatório */}
        <OnboardingModal 
          isOpen={needsOnboarding} 
          onComplete={handleOnboardingComplete}
        />
        
        {/* Conteúdo da página (fica "travado" enquanto modal está aberto) */}
        <div className={needsOnboarding ? 'pointer-events-none filter blur-sm' : ''}>
          {children}
        </div>
      </>
    );
  }
  
  return null;
}

