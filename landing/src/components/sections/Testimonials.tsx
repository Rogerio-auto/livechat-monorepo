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
          <Card key={testimonial.company} className="p-6">
            <p className="text-[10px] uppercase font-bold tracking-[0.3em] text-primary">{testimonial.company}</p>
            <p className="mt-4 text-base italic text-muted-foreground">“{testimonial.quote}”</p>
            <div className="mt-6 flex flex-col">
              <span className="text-sm font-bold text-foreground">{testimonial.author}</span>
              <span className="text-xs text-muted-foreground">{testimonial.role}</span>
            </div>
          </Card>
        ))}
      </div>
    </Container>
  </section>
);
