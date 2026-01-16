import { FiArrowUpRight } from "react-icons/fi";
import { Link } from "react-router-dom";
import { HERO_STATS } from "../../utils/constants";
import { Container } from "../ui/Container";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export const Hero = () => {
  return (
    <section className="relative overflow-hidden pb-20 pt-16" id="top">
      <Container className="relative z-10 grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <Badge variant="default">Nova stack omnichannel</Badge>
          <h1 className="mt-6 text-4xl font-semibold leading-tight text-slate-900 sm:text-5xl">
            Venda, atenda e automatize tudo em uma única plataforma conversacional.
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Conecte WhatsApp, IA e automações visuais para gerar leads, nutrir relacionamentos e ativar campanhas
            multicanal com time reduzido.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" asChild>
              <a href="#precos">Ver planos e começar <FiArrowUpRight className="ml-2 inline-block" /></a>
            </Button>
            <Button size="lg" variant="secondary" asChild>
              <Link to="/demo">Agendar demonstração</Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {HERO_STATS.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-semibold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
                <p className="text-xs text-slate-400">{stat.detail}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="relative rounded-[32px] border border-white/60 bg-white/80 p-6 shadow-soft backdrop-blur">
          <div className="space-y-6">
            <div className="rounded-2xl bg-slate-900/90 p-6 text-white">
              <p className="text-sm text-white/70">Flow Builder</p>
              <h3 className="mt-3 text-2xl font-semibold">Campanha "Recepção quente"</h3>
              <ul className="mt-4 space-y-2 text-sm text-white/80">
                <li>1. Captura lead via QR Code</li>
                <li>2. Qualifica com IA + tags</li>
                <li>3. Agenda demo automática</li>
                <li>4. Envia proposta + assinatura</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-primary">Performance</p>
              <p className="mt-3 text-3xl font-semibold text-slate-900">+312 leads</p>
              <p className="text-sm text-slate-500">gerados no último trimestre</p>
            </div>
          </div>
        </div>
      </Container>
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-full bg-[radial-gradient(circle_at_top,_rgba(47,180,99,0.20),_transparent_60%)]" />
    </section>
  );
};
