import '../style.css';
import { useEffect } from 'react';
import { CLogin } from '../componets/login/compo-login';
import { InfLogin } from '../componets/login/infor-login';

export function Login() {
  const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const devCompany = (import.meta.env.VITE_DEV_COMPANY_ID as string | undefined)?.trim();
        const headers = devCompany && import.meta.env.DEV ? { 'X-Company-Id': devCompany } : undefined;
        const res = await fetch(`${API}/auth/me`, { credentials: 'include', headers });
        if (!mounted) return;
        if (res.ok) window.location.replace('/dashboard');
      } catch {}
    })();
    return () => { mounted = false; };
  }, [API]);
  
  return (
    <main className="min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/20 transition-colors duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 min-h-screen">
        {/* Coluna esquerda - Formulário de Login */}
        <div className="flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            <CLogin />
          </div>
        </div>

        {/* Coluna direita - Informações */}
        <div className="hidden lg:flex items-center justify-center p-6 lg:p-12 bg-linear-to-br from-blue-500/5 via-transparent to-transparent border-l border-gray-200 dark:border-gray-700">
          <div className="w-full max-w-md">
            <InfLogin />
          </div>
        </div>
      </div>
    </main>
  );
}
