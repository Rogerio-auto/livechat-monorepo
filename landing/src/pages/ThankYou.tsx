import { Link } from "react-router-dom";
import { Container } from "../components/ui/Container";
import { Button } from "../components/ui/Button";
import { usePageMeta } from "../hooks/usePageMeta";
import { getSignupUrl } from "../utils/redirect";

const ThankYou = () => {
  usePageMeta({
    title: "Obrigado",
    description: "Mensagem de confirmação após formulários ou cadastros",
  });

  return (
    <section className="py-24">
      <Container className="text-center">
        <div className="mx-auto max-w-2xl rounded-3xl border border-slate-100 bg-white/80 p-10 shadow-soft">
          <span className="text-xs font-semibold uppercase tracking-[0.4em] text-primary">Mensagem enviada</span>
          <h1 className="mt-4 text-4xl font-semibold text-slate-900">Obrigado! Já estamos preparando tudo para você.</h1>
          <p className="mt-3 text-base text-slate-500">
            Você receberá um email com os próximos passos para acessar sua conta. Enquanto isso, aproveite para explorar nossa base de conhecimento.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild>
              <a href={getSignupUrl("starter")}>Ir para cadastro</a>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/">Voltar ao início</Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default ThankYou;
