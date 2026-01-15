import { NICHES } from "../../utils/constants";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";

export const Niches = () => (
  <section id="niches" className="py-16">
    <Container>
      <SectionHeading
        eyebrow="Playbooks prontos"
        title="7 verticais já configuradas com fluxos, personas e métricas"
        description="Energia solar, educação, saúde, imobiliário, eventos, jurídico e varejo já contam com fluxos, campanhas e cadências pré-carregadas."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {NICHES.map((niche) => (
          <div
            key={niche.id}
            className="rounded-3xl border border-slate-100 bg-white/80 p-5 shadow-soft transition hover:-translate-y-1 hover:border-primary/50"
          >
            <p className="text-sm uppercase tracking-[0.4em] text-slate-400">{niche.id}</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">{niche.label}</h3>
            <p className="mt-3 text-sm text-slate-500">{niche.metric}</p>
          </div>
        ))}
      </div>
    </Container>
  </section>
);
