import EmpresaPanel from "../../componets/company/EmpresaPanel";
import { useCompanySettings } from "../../hooks/useCompanySettings";

export default function EmpresaPage() {
  const { form, setForm, baseline, loading, error, userRole, onSaved } = useCompanySettings();

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-red-500">
        Erro ao carregar dados: {error}
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Dados da Empresa</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Gerencie as informações públicas e o plano da sua organização.</p>
      </div>
      <EmpresaPanel 
        form={form} 
        baseline={baseline} 
        setForm={setForm} 
        onSaved={onSaved} 
        userRole={userRole}
      />
    </div>
  );
}
