import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LoadingOverlay } from '../ui/LoadingOverlay';
import { useCadastroStatus } from '../../hooks/useCadastroStatus';
import { useAuth } from '../../context/AuthContext';

type Props = {
  children: React.ReactNode;
  roles?: string[];
};

export function RequireAuth({ children, roles }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [roleAllowed, setRoleAllowed] = useState(true);
  const { needsOnboarding, loading: onboardingLoading } = useCadastroStatus();
  const rolesKey = roles?.join('|') ?? '';
  const normalizedRoles = useMemo(() => (roles ? roles.map((role) => role.toUpperCase()) : []), [rolesKey]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      navigate('/login', { replace: true, state: { from: location.pathname } });
      return;
    }

    const userRole = String(user?.role ?? '').toUpperCase();
    const allowed = normalizedRoles.length === 0 || normalizedRoles.includes(userRole);
    setRoleAllowed(allowed);

    if (!allowed) {
      navigate('/dashboard', { replace: true });
      return;
    }

    // Se precisa configurar telefone e não está na página de perfil, redirecionar
    if (user.requires_phone_setup && location.pathname !== '/perfil') {
      navigate('/perfil', { replace: true, state: { requiresPhone: true } });
      return;
    }
  }, [user, authLoading, navigate, location.pathname, normalizedRoles]);

  // Efeito separado para redirecionamento de onboarding
  useEffect(() => {
    if (authLoading || onboardingLoading || !user) return;

    const isCadastroPage = location.pathname === '/cadastro';

    if (needsOnboarding && !isCadastroPage) {
      console.log('Redirecionando para onboarding (cadastro)...');
      navigate('/cadastro', { replace: true });
    } else if (!needsOnboarding && isCadastroPage) {
      console.log('Onboarding já concluído, redirecionando para dashboard...');
      navigate('/dashboard', { replace: true });
    }
  }, [user, authLoading, onboardingLoading, needsOnboarding, location.pathname, navigate]);

  if (authLoading || onboardingLoading) {
    return <LoadingOverlay text="Verificando sessão..." fullscreen />;
  }
  
  if (!user) {
    return null; // O useEffect cuidará do redirecionamento para /login
  }

  // Se precisa de onboarding e não está na página de cadastro, não renderiza nada (espera o redirect)
  if (needsOnboarding && location.pathname !== '/cadastro') {
    return <LoadingOverlay text="Redirecionando para cadastro..." fullscreen />;
  }

  // Se NÃO precisa de onboarding e ESTÁ na página de cadastro, não renderiza nada (espera o redirect)
  if (!needsOnboarding && location.pathname === '/cadastro') {
    return <LoadingOverlay text="Redirecionando para dashboard..." fullscreen />;
  }
  
  if (user) {
    if (!roleAllowed) {
      return null;
    }
    return (
      <>
        {children}
      </>
    );
  }
  
  return null;
}

