import { FAQS } from "../../utils/constants";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";

export const FAQSection = () => (
  <section className="py-16">
    <Container>
      <SectionHeading
        eyebrow="FAQ"
        title="Dúvidas frequentes"
        description="Documentação LGPD, onboarding e integrações prontas. Fale com o time em tempo real pelo WhatsApp prioritário."
        align="center"
      />
      <div className="mx-auto max-w-3xl divide-y divide-slate-100 rounded-3xl border border-slate-100 bg-white/70">
        {FAQS.map((faq) => (
          <details key={faq.question} className="group">
            <summary className="cursor-pointer list-none px-6 py-5 text-left text-base font-semibold text-slate-900">
              {faq.question}
            </summary>
            <p className="px-6 pb-6 text-sm text-slate-600">{faq.answer}</p>
          </details>
        ))}
      </div>
    </Container>
  </section>
);
