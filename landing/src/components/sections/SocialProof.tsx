import { Container } from "../ui/Container";
import { Card } from "../ui/Card";

const LOGOS = ["SolPrime", "ClinLife", "VivaEdu", "ImoPro", "LexDigital", "RetailX"];

const QUOTE = {
  text: "Implementamos fluxos omnichannel em 14 dias e reduzimos o tempo médio de resposta de 12h para 18min.",
  author: "Larissa Menezes",
  role: "Head de Operações na SolPrime",
};

export const SocialProof = () => (
  <section className="py-12" aria-label="Prova social">
    <Container>
      <p className="text-center text-xs font-semibold uppercase tracking-[0.6em] text-muted-foreground/60">Confiado por scale-ups em 7 nichos</p>
      <div className="mt-8 grid grid-cols-2 gap-4 text-xs font-bold text-muted-foreground sm:grid-cols-3 lg:grid-cols-6 uppercase tracking-widest">
        {LOGOS.map((logo) => (
          <div key={logo} className="flex items-center justify-center rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-4">
            {logo}
          </div>
        ))}
      </div>
      <Card className="mt-12 text-center p-8 bg-card/30 border-border/40">
        <p className="text-lg italic text-foreground">“{QUOTE.text}”</p>
        <p className="mt-6 text-sm font-bold text-foreground">{QUOTE.author}</p>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{QUOTE.role}</p>
      </Card>
    </Container>
  </section>
);
