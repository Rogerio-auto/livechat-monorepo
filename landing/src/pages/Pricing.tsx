import { PLANS } from "../utils/constants";
import { getSignupUrl } from "../utils/redirect";
import { Container } from "../components/ui/Container";
import { SectionHeading } from "../components/ui/SectionHeading";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { usePageMeta } from "../hooks/usePageMeta";

const Pricing = () => {
  usePageMeta({
    title: "Planos e preços",
    description: "Escolha o melhor plano para o seu negócio com 30 dias de teste gratuito.",
  });

  return (
    <section className="py-16">
      <Container>
        <SectionHeading
          eyebrow="Valores"
          title="Escolha o plano ideal para sua escala"
          description="Ative seu teste gratuito em menos de 2 minutos e comece a escalar seu atendimento agora mesmo."
          align="center"
        />
        <div className="grid gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <Card key={plan.id} glow={plan.id === "growth"}>
              {plan.badge && (
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{plan.badge}</span>
              )}
              <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-3xl font-semibold text-slate-900">{plan.name}</h3>
                  <p className="text-sm text-slate-500">{plan.description}</p>
                </div>
                <p className="text-3xl font-semibold text-slate-900">
                  R$ {plan.price}
                  <span className="text-base font-normal text-slate-400">/mês</span>
                </p>
              </div>
              <p className="mt-4 text-sm text-slate-500">{plan.quota}</p>
              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {plan.notIncluded && plan.notIncluded.length > 0 && (
                <p className="mt-4 text-xs text-slate-400">Não inclui: {plan.notIncluded.join(", ")}</p>
              )}
              <Button className="mt-6 w-full" size="lg" href={getSignupUrl(plan.id)}>
                {plan.cta}
              </Button>
            </Card>
          ))}
        </div>
        <div className="mt-10 rounded-3xl border border-primary/20 bg-primary/5 p-6 text-sm text-slate-600 italic text-center">
          <p>
            Todos os planos incluem suporte prioritário, atualizações constantes e segurança de dados garantida.
          </p>
        </div>
      </Container>
    </section>
  );
};

export default Pricing;
