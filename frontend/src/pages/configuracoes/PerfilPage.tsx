import PerfilPanel from "../../components/profile/PerfilPanel";
import { useProfileSettings } from "../../hooks/useProfileSettings";

export default function PerfilPage() {
  const { form, setForm, baseline, loading, error, onSaved } = useProfileSettings();

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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Meu Perfil</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Atualize suas informações pessoais e preferências de conta.</p>
      </div>
      <PerfilPanel 
        form={form} 
        baseline={baseline} 
        setForm={setForm} 
        onSaved={onSaved} 
      />
    </div>
  );
}
