import { Container } from "../ui/Container";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";

export const FinalCTA = () => (
  <section className="pb-20 pt-10">
    <Container>
      <div className="relative overflow-hidden rounded-[40px] border border-primary/20 bg-gradient-to-r from-primary to-secondary px-10 py-12 text-white shadow-soft">
        <Badge variant="neutral">Pronto para executar</Badge>
        <h3 className="mt-4 text-3xl font-semibold">Ative seu teste gratuito e transforme sua comunicação.</h3>
        <p className="mt-3 max-w-2xl text-white/90">
          Nossa plataforma foi desenhada para escalar com você. Comece hoje mesmo e sinta a diferença de uma gestão verdadeiramente omnichannel.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button variant="secondary" href="#precos">
            Escolher meu plano
          </Button>
          <Button variant="ghost" href="/demo" className="text-white hover:text-white/80">
            Falar com especialista
          </Button>
        </div>
      </div>
    </Container>
  </section>
);
