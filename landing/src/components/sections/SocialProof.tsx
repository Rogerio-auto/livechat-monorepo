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
      <p className="text-center text-xs font-semibold uppercase tracking-[0.6em] text-slate-400">Confiado por scale-ups em 7 nichos</p>
      <div className="mt-6 grid grid-cols-2 gap-6 text-sm text-slate-500 sm:grid-cols-3 lg:grid-cols-6">
        {LOGOS.map((logo) => (
          <div key={logo} className="flex items-center justify-center rounded-2xl border border-slate-100 bg-white/70 p-4">
            {logo}
          </div>
        ))}
      </div>
      <Card className="mt-10 text-center">
        <p className="text-lg text-slate-600">“{QUOTE.text}”</p>
        <p className="mt-4 text-sm font-semibold text-slate-900">{QUOTE.author}</p>
        <p className="text-xs uppercase tracking-wide text-slate-400">{QUOTE.role}</p>
      </Card>
    </Container>
  </section>
);
