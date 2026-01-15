import { TESTIMONIALS } from "../../utils/constants";
import { Container } from "../ui/Container";
import { SectionHeading } from "../ui/SectionHeading";
import { Card } from "../ui/Card";

export const Testimonials = () => (
  <section className="py-16">
    <Container>
      <SectionHeading
        eyebrow="Casos reais"
        title="Times que operam mais rápido e com previsibilidade"
        align="center"
      />
      <div className="grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial) => (
          <Card key={testimonial.company}>
            <p className="text-sm uppercase tracking-[0.3em] text-primary">{testimonial.company}</p>
            <p className="mt-3 text-base text-slate-600">“{testimonial.quote}”</p>
            <p className="mt-4 text-sm font-semibold text-slate-900">{testimonial.author}</p>
            <p className="text-xs text-slate-400">{testimonial.role}</p>
          </Card>
        ))}
      </div>
    </Container>
  </section>
);
