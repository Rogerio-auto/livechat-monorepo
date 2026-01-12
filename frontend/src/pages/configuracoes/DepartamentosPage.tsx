import { DepartmentsManager } from "../../components/admin/DepartmentsManager";

export default function DepartamentosPage() {
  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Departamentos</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Organize sua empresa em departamentos para melhor gestão de atendimentos e equipes.
        </p>
      </div>
      
      <DepartmentsManager />
    </div>
  );
}
