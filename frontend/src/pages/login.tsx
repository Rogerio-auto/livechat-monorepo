import '../style.css';
import { useEffect } from 'react';
import { CLogin } from '../componets/login/compo-login';
import { InfLogin } from '../componets/login/infor-login';
import BgImage from '../assets/bg-login.jpeg';





export function Login() {
  const API = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || "http://localhost:5000";
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${API}/auth/me`, { credentials: 'include' });
        if (!mounted) return;
        if (res.ok) window.location.replace('/dashboard');
      } catch {}
    })();
    return () => { mounted = false; };
  }, [API]);
  return (
    <>
      <main
        className="relative grid grid-cols-2 bg-cover bg-center min-h-screen"
        style={{ backgroundImage: `url(${BgImage})` }}
      >
        {/* Overlay atrás */}
        <div className="absolute inset-0 bg-[#204A34]/80 backdrop-blur z-0"></div>

        {/* Conteúdo acima do overlay */}
        <div className="relative z-10 flex items-center justify-center">
          <CLogin />
        </div>

        <div className="relative z-10 flex items-center justify-center">
          <InfLogin />
        </div>
      </main>
    </>
  );
}
