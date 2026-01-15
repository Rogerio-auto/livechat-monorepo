import { Link } from "react-router-dom";
import { CONTACT_CHANNELS, NAV_LINKS } from "../../utils/constants";
import { Container } from "../ui/Container";

export const Footer = () => (
  <footer className="border-t border-white/30 bg-slate-900 text-slate-200">
    <Container className="py-12">
      <div className="grid gap-10 md:grid-cols-2">
        <div>
          <p className="text-lg font-semibold">7Sion Plataforma Conversacional</p>
          <p className="mt-3 max-w-md text-sm text-slate-400">
            Uma única stack para captar, nutrir e converter clientes com IA, automação visual e atendimento humano.
          </p>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-slate-500">© {new Date().getFullYear()} 7Sion.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold text-white">Navegação</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              {NAV_LINKS.map((link) => (
                <li key={link.label}>
                  <Link to={link.path}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Contato</h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              {CONTACT_CHANNELS.map((item) => (
                <li key={item.label}>
                  {item.href ? (
                    <a href={item.href} target="_blank" rel="noreferrer">
                      <span className="block text-white">{item.label}</span>
                      <span className="text-slate-400">{item.value}</span>
                    </a>
                  ) : (
                    <div>
                      <span className="block text-white">{item.label}</span>
                      <span className="text-slate-400">{item.value}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-xs text-slate-500">
        <div className="flex gap-4">
          <Link to="/termos" className="hover:text-white transition-colors">Termos</Link>
          <span className="text-white/10">•</span>
          <Link to="/privacidade" className="hover:text-white transition-colors">Privacidade</Link>
          <span className="text-white/10">•</span>
          <Link to="/lgpd" className="hover:text-white transition-colors">LGPD</Link>
        </div>
        <span>Infraestrutura: AWS São Paulo + Supabase</span>
      </div>
    </Container>
  </footer>
);
