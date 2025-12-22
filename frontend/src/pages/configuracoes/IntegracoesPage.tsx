import IntegracoesPanel from "../../componets/integrations/IntegracoesPanel";

export default function IntegracoesPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Integrações</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Conecte o sistema com outras ferramentas e serviços para expandir suas funcionalidades.</p>
      </div>
      <IntegracoesPanel />
    </div>
  );
}
