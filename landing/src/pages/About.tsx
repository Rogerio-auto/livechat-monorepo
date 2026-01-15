import { Container } from "../components/ui/Container";
import { SectionHeading } from "../components/ui/SectionHeading";
import { Card } from "../components/ui/Card";
import { usePageMeta } from "../hooks/usePageMeta";

const milestones = [
  { year: "2021", title: "Primeira operação solar", detail: "Automação de prospecção para integradores." },
  { year: "2022", title: "Stack omnichannel", detail: "Livechat + IA + FlowBuilder em único painel." },
  { year: "2024", title: "Escala multi-nicho", detail: "Playbooks para educação, saúde, varejo e jurídico." },
  { year: "2025", title: "7Sion Platform", detail: "Integrações Meta Cloud, WAHA, OpenAI Projects." },
];

const About = () => {
  usePageMeta({
    title: "Sobre a 7Sion",
    description: "Conheça a história, a nossa infraestrutura e a visão por trás da plataforma que está revolucionando o atendimento digital.",
  });

  return (
    <section className="py-16">
      <Container>
        <SectionHeading
          eyebrow="Sobre"
          title="Construímos a infraestrutura para times que buscam escala e eficiência"
          description="Nossa tecnologia é modular e escalável, garantindo que sua operação nunca pare de crescer, com o máximo de segurança e performance."
        />
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <h3 className="text-xl font-semibold text-slate-900">Missão</h3>
            <p className="mt-3 text-sm text-slate-600">
              Permitir que qualquer time crie experiências conversacionais de ponta, combinando IA generativa, atendimento humano e fluxos automatizados em poucos dias.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>• Stack modular para múltiplos nichos</li>
              <li>• Compliance LGPD + infraestrutura no Brasil</li>
              <li>• Integrações oficiais e suporte especializado</li>
            </ul>
          </Card>
          <Card>
            <h3 className="text-xl font-semibold text-slate-900">Infra</h3>
            <p className="mt-3 text-sm text-slate-600">
              Backend Node 20 + Supabase, Redis e RabbitMQ. Observabilidade com Grafana + Sentry, deploy contínuo e filas dedicadas para campanhas e fluxos.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              <li>• Socket.io para chat e notificações</li>
              <li>• Workers dedicados para FlowBuilder</li>
              <li>• CDN para mídia e documentos</li>
            </ul>
          </Card>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {milestones.map((item) => (
            <div key={item.year} className="rounded-3xl border border-slate-100 bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.3em] text-primary">{item.year}</p>
              <h4 className="mt-2 text-lg font-semibold text-slate-900">{item.title}</h4>
              <p className="text-sm text-slate-500">{item.detail}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
};

export default About;
