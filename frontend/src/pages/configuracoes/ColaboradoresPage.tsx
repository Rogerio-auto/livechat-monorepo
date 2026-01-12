import AgentesPanel from "../../components/users/AgentesPanel";

export default function ColaboradoresPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Colaboradores</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Gerencie os usuários do sistema e suas permissões de acesso.
        </p>
      </div>
      
      <AgentesPanel />
    </div>
  );
}
