import { Container } from "../components/ui/Container";
import { usePageMeta } from "../hooks/usePageMeta";

const LGPD = () => {
  usePageMeta({
    title: "Conformidade LGPD",
    description: "Nossa jornada de transparência e os pilares de segurança de dados sob a égide da Lei Geral de Proteção de Dados.",
  });

  return (
    <section className="py-20">
      <Container>
        <div className="mx-auto max-w-3xl prose prose-slate">
          <div className="mb-10 text-center">
            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
              Compliance LGPD
            </span>
            <h1 className="text-4xl font-bold text-slate-900 mb-4">Proteção de Dados e Transparência</h1>
            <p className="text-lg text-slate-600">
              Como a 7Sion garante a segurança da sua operação e a privacidade dos seus clientes.
            </p>
          </div>

          <div className="space-y-12 text-slate-700">
            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">O que é a LGPD?</h2>
              <p>
                A Lei Geral de Proteção de Dados (Lei nº 13.709/2018) regulamenta o tratamento de dados pessoais no Brasil, garantindo direitos fundamentais de liberdade e de privacidade aos cidadãos. Na 7Sion, a LGPD não é apenas uma obrigação legal, mas um diferencial competitivo.
              </p>
            </section>

            <section className="grid gap-6 md:grid-cols-2">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Finalidade Específica</h3>
                <p className="text-sm">Coletamos apenas o estritamente necessário para que sua automação funcione. Nada a mais, nada a menos.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Segurança Robusta</h3>
                <p className="text-sm">Dados criptografados de ponta a ponta (AES-256) com backups automatizados em infraestrutura brasileira.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Controle do Titular</h3>
                <p className="text-sm">Seus clientes podem solicitar a exclusão de seus dados a qualquer momento via API ou painel administrativo.</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 mb-2">Logs de Acesso</h3>
                <p className="text-sm">Registramos todas as operações de tratamento de dados para fins de auditoria e segurança jurídica.</p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-slate-900 mb-4">Nossa Arquitetura de Proteção</h2>
              <p className="mb-4">
                Utilizamos provedores de serviços especializados que cumprem com os mais altos certificados de segurança globais (ISO 27001, SOC2 Type II), como:
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li><strong>AWS (Amazon Web Services):</strong> Servidores localizados fisicamente em São Paulo para minimizar transferência internacional de dados.</li>
                <li><strong>Supabase / PostgREST:</strong> Camada de banco de dados com isolamento por tenant (RSL - Row Level Security).</li>
                <li><strong>Meta Cloud API:</strong> Integração direta sem intermediários (Brokers) de dados não autorizados.</li>
              </ul>
            </section>

            <section className="rounded-3xl bg-slate-900 p-8 text-white">
              <h2 className="text-2xl font-semibold mb-4">Central de Privacidade</h2>
              <p className="text-slate-300 mb-6 font-light">
                Dúvidas sobre como tratamos os dados? Precisa de um Relatório de Impacto à Proteção de Dados Pessoais (RIPD)? Nosso canal exclusivo está à disposição.
              </p>
              <a 
                href="mailto:suporte@7sion.com"
                className="inline-block px-6 py-3 bg-primary text-white font-semibold rounded-full hover:bg-primary-dark transition-colors"
                target="_blank"
                rel="noreferrer"
              >
                Falar com o Compliance
              </a>
            </section>
          </div>
        </div>
      </Container>
    </section>
  );
};

export default LGPD;
