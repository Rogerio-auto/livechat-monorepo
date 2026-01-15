import { Container } from "../components/ui/Container";
import { SectionHeading } from "../components/ui/SectionHeading";
import { Button } from "../components/ui/Button";
import { usePageMeta } from "../hooks/usePageMeta";

const Demo = () => {
  usePageMeta({
    title: "Agendar demonstração",
    description: "Selecione um horário e veja nossa plataforma em ação com dados reais.",
  });

  return (
    <section className="py-16">
      <Container>
        <SectionHeading
          eyebrow="Agenda"
          title="Demonstração prática em 30 minutos"
          description="Entenda como nossa solução se integra ao seu fluxo de trabalho e acelera seus resultados."
          align="center"
        />
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="rounded-3xl border border-slate-100 bg-white/80 p-6 text-sm text-slate-600 shadow-soft">
            <h3 className="text-xl font-semibold text-slate-900">O que vamos cobrir</h3>
            <ul className="mt-4 space-y-2">
              <li>• Automatização de prospecção e vendas</li>
              <li>• Gestão de contatos e CRM integrado</li>
              <li>• Fluxos inteligentes com IA Generativa</li>
              <li>• Dashboards de performance e conversão</li>
            </ul>
            <p className="mt-4">Também apresentamos o roadmap e como personalizamos para cada nicho.</p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-soft">
            <div className="aspect-video w-full rounded-2xl bg-slate-100">
              {/* Placeholder para embed de Calendly ou vídeo */}
              <div className="flex h-full items-center justify-center text-sm text-slate-400">Embed Calendly / Vídeo</div>
            </div>
            <Button className="mt-4 w-full" href="https://calendly.com/7sion/demo" target="_blank" rel="noreferrer">
              Escolher horário
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default Demo;
