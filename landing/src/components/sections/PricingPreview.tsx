import { PLANS } from "../../utils/constants";
import { getSignupUrl } from "../../utils/redirect";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";

export const PricingPreview = () => (
  <section className="py-16" id="precos">
    <Container>
      <SectionHeading
        eyebrow="Planos com 30 dias de teste"
        title="Comece grátis, migre quando estiver pronto"
        description="Escolha o plano que melhor se adapta ao seu momento e comece agora. Sem necessidade de cartão de crédito para testar."
        align="center"
      />
      <div className="grid gap-6 lg:grid-cols-4">
        {PLANS.map((plan) => (
          <Card key={plan.id} glow={plan.id === "growth"} className="flex h-full flex-col">
            {plan.badge && (
              <span className="text-xs font-semibold uppercase tracking-[0.3em] text-primary">{plan.badge}</span>
            )}
            <h3 className="mt-4 text-2xl font-semibold text-slate-900">{plan.name}</h3>
            <p className="text-sm text-slate-500">{plan.description}</p>
            <p className="mt-5 text-3xl font-semibold text-slate-900">
              R$ {plan.price}
              <span className="text-base font-normal text-slate-400">/mês</span>
            </p>
            <p className="text-sm text-slate-500">{plan.quota}</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {plan.notIncluded && plan.notIncluded.length > 0 && (
              <p className="mt-4 text-xs text-slate-400">
                Não inclui: {plan.notIncluded.join(", ")}
              </p>
            )}
            <Button className="mt-6" href={getSignupUrl(plan.id)}>
              {plan.cta}
            </Button>
          </Card>
        ))}
      </div>
      <p className="mt-8 text-center text-sm text-slate-500 italic">
        Precisa de uma solução personalizada? <span className="font-semibold text-primary cursor-pointer hover:underline">Fale com nossos especialistas.</span>
      </p>
    </Container>
  </section>
);
