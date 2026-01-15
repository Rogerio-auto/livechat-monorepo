import { Container } from "../components/ui/Container";
import { usePageMeta } from "../hooks/usePageMeta";

const Terms = () => {
  usePageMeta({
    title: "Termos e Condições de Uso",
    description: "Regras de uso, compliance com API oficial do WhatsApp e responsabilidades legais da plataforma 7Sion.",
  });

  return (
    <section className="py-20">
      <Container>
        <div className="mx-auto max-w-3xl prose prose-slate">
          <h1 className="text-4xl font-bold text-slate-900 mb-8">Termos de Serviço</h1>
          <p className="text-sm text-slate-500 mb-10">Última atualização: 15 de Janeiro de 2026 | Versão 2.1 - Business API Compliant</p>

          <div className="space-y-10 text-slate-700 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. Objeto e Aceitação</h2>
              <p>
                Estes Termos regulam o acesso e o uso da Plataforma 7Sion, um software como serviço (SaaS) focado em automação conversacional e gestão omnichannel. Ao utilizar nossa plataforma, você concorda integralmente com estes termos, bem como com as políticas vigentes da <strong>Meta Platform (Facebook/WhatsApp)</strong>.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. Compliance com Meta e WhatsApp</h2>
              <p>O usuário reconhece e aceita que:</p>
              <ul className="list-disc pl-5 mt-4 space-y-3">
                <li>
                  É estritamente proibido o uso da plataforma para envio de conteúdo não solicitado (SPAM), conforme definido pela Meta.
                </li>
                <li>
                  O usuário é responsável por obter o <strong>Opt-in (consentimento prévio)</strong> de seus clientes antes de iniciar qualquer conversa por canais oficiais.
                </li>
                <li>
                  A 7Sion atua como provedora da interface e lógica de automação, mas o uso da infraestrutura do WhatsApp está sujeito à aprovação e diretrizes comerciais da própria Meta.
                </li>
                <li>
                  Qualquer violação das <a href="https://www.whatsapp.com/legal/business-policy/" target="_blank" className="text-primary hover:underline">Políticas Comerciais do WhatsApp</a> resultará no encerramento imediato da conta sem direito a reembolso.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. Deveres do Usuário</h2>
              <p>
                O usuário deve manter a integridade de suas credenciais de acesso, sendo o único responsável por qualquer atividade realizada sob sua conta. É vedado o uso da plataforma para:
              </p>
              <ul className="list-disc pl-5 mt-4 space-y-3">
                <li>Transmitir vírus, malwares ou qualquer código de natureza destrutiva.</li>
                <li>Hospedar ou disseminar conteúdo ilegal, ofensivo ou discriminatório.</li>
                <li>Tentar burlar sistemas de segurança ou limites da API.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. Planos, Cobrança e Cancelamento</h2>
              <p>
                Nossos planos são pré-pagos e recorrentes. O cliente pode realizar o upgrade, downgrade ou cancelamento a qualquer momento através do painel. Em caso de cancelamento, o acesso permanecerá disponível até o final do período já pago. Não realizamos reembolsos retroativos por períodos não utilizados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Propriedade Intelectual</h2>
              <p>
                Todo o código, design, fluxos proprietários e logotipos da 7Sion são de propriedade exclusiva da nossa empresa. O usuário não adquire qualquer direito sobre o software além da licença de uso temporário.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Limitação de Responsabilidade</h2>
              <p>
                A 7Sion não será responsável por perdas de dados, lucros interrompidos ou banimentos de números causados por terceiros ou mau uso do cliente. Garantimos o funcionamento técnico da nossa plataforma conforme especificado em nossos canais oficiais, salvo interrupções programadas para manutenção.
              </p>
            </section>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default Terms;
