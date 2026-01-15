import { FEATURES } from "../../utils/constants";
import { Container } from "../ui/Container";
import { Card } from "../ui/Card";
import { SectionHeading } from "../ui/SectionHeading";

export const FeatureGrid = () => (
  <section id="features" className="py-16">
    <Container>
      <SectionHeading
        eyebrow="Stack completa"
        title="10 módulos para operar marketing, vendas e atendimento com IA"
        description="Conectamos equipes e canais em um único painel: chat, IA, automação visual, CRM, campanhas, analytics e mais."
        align="center"
      />
      <div className="grid gap-6 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <Card key={feature.id} className="h-full">
            {feature.badge && (
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{feature.badge}</span>
            )}
            <h3 className="mt-4 text-2xl font-semibold text-slate-900">{feature.title}</h3>
            <p className="mt-2 text-sm text-slate-500">{feature.description}</p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {feature.bullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </Container>
  </section>
);
