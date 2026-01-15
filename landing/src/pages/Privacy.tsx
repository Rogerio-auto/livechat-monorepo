import { Container } from "../components/ui/Container";
import { usePageMeta } from "../hooks/usePageMeta";

const Privacy = () => {
  usePageMeta({
    title: "Política de Privacidade e Proteção de Dados",
    description: "Conheça como a 7Sion gerencia e protege dados em total conformidade com a LGPD e políticas da Meta/WhatsApp.",
  });

  return (
    <section className="py-20">
      <Container>
        <div className="mx-auto max-w-3xl prose prose-slate">
          <h1 className="text-4xl font-bold text-slate-900 mb-8">Política de Privacidade</h1>
          <p className="text-sm text-slate-500 mb-10">Última atualização: 15 de Janeiro de 2026 | Versão 2.1 - Meta Compliance Ready</p>

          <div className="space-y-10 text-slate-700 leading-relaxed">
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. Compromisso com a Privacidade</h2>
              <p>
                A 7Sion ("nós", "nosso") entende a importância da privacidade dos dados para fornecedores de soluções de tecnologia (ISVs). Nossa plataforma foi construída sob os princípios de "Privacy by Design" e "Privacy by Default", garantindo que tanto os nossos dados quanto os de seus clientes finais estejam protegidos sob os mais rigorosos padrões da LGPD (Lei Geral de Proteção de Dados - Lei 13.709/2018).
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. Dados que Coletamos</h2>
              <p>Como parceiros de tecnologia e API Business, coletamos dados em três níveis:</p>
              <ul className="list-disc pl-5 mt-4 space-y-3">
                <li>
                  <strong>Dados Cadastrais do Cliente:</strong> Nome, CPF/CNPJ, e-mail comercial, telefone, endereço e informações de faturamento.
                </li>
                <li>
                  <strong>Dados de Integração (Meta/WhatsApp):</strong> Tokens de acesso à API, IDs de conta de negócios e metadados de mensagens necessários para o roteamento e funcionamento dos fluxos.
                </li>
                <li>
                  <strong>Dados de Navegação e Performance:</strong> Endereços IP, logs de erros, tempo de resposta da API e cookies essenciais para autenticação de sessão.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. Finalidade e Base Legal</h2>
              <p>Tratamos dados pessoais baseados nas seguintes hipóteses legais da LGPD:</p>
              <ul className="list-disc pl-5 mt-4 space-y-3">
                <li><strong>Execução de Contrato:</strong> Para fornecer as funcionalidades SaaS contratadas.</li>
                <li><strong>Cumprimento de Obrigação Legal:</strong> Emissão de notas fiscais e armazenamento de logs de conexão conforme o Marco Civil da Internet.</li>
                <li><strong>Legítimo Interesse:</strong> Melhoria da segurança da plataforma e prevenção de fraudes.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. Segurança e Armazenamento</h2>
              <p>
                A 7Sion utiliza infraestrutura de classe mundial (AWS - Região São Paulo e Supabase) com criptografia em repouso (AES-256) e em trânsito (TLS 1.2+). Implementamos políticas rigorosas de controle de acesso (IAM) e auditorias periódicas em nosso backend e banco de dados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Compartilhamento com Terceiros</h2>
              <p>
                Apenas compartilhamos dados estritamente necessários com:
              </p>
              <ul className="list-disc pl-5 mt-4 space-y-3">
                <li><strong>Meta/WhatsApp Business API:</strong> Para viabilizar o envio e recebimento de mensagens através de canais oficiais.</li>
                <li><strong>Operadores de Nuvem:</strong> AWS e Supabase para hospedagem e backup.</li>
                <li><strong>Processadores de Pagamento:</strong> Stripe para gestão de assinaturas e recorrência.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Seus Direitos e Contato (DPO)</h2>
              <p>
                Você possui direitos de acesso, retificação, exclusão e portabilidade dos seus dados. Designamos nosso canal de suporte como o ponto central para requisições de titulares.
              </p>
              <p className="mt-4 bg-slate-50 p-4 border-l-4 border-primary rounded-r-lg">
                <strong>Encarregado de Dados (DPO):</strong> <br />
                Equipe de Compliance 7Sion<br />
                E-mail: <strong>suporte@7sion.com</strong>
              </p>
            </section>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default Privacy;
