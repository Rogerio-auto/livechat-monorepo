import { useState } from "react";
import { FiX, FiCheck, FiAlertCircle } from "react-icons/fi";
import { Industry } from "../../types/onboarding";
import { INDUSTRY_OPTIONS, getIndustryConfig } from "../../config/industry-config";
import { IndustryBadge } from "./IndustryBadge";

interface EditIndustryModalProps {
  company: {
    id: string;
    name: string;
    industry: Industry | null;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export function EditIndustryModal({ company, onClose, onSuccess }: EditIndustryModalProps) {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry>(
    company.industry || "solar_energy"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/admin/companies/${company.id}/industry`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ industry: selectedIndustry }),
      });

      if (!res.ok) {
        const data = await res.json();
        // Mostrar detalhes do erro se disponível
        const errorMsg = data.details 
          ? `${data.error}: ${data.details}` 
          : data.error || "Erro ao atualizar nicho";
        throw new Error(errorMsg);
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("[EditIndustryModal] Erro ao salvar:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedConfig = getIndustryConfig(selectedIndustry);

  return (
    <div 
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-60 p-4"
      onClick={onClose}
    >
      <div
        className="config-modal rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b config-divider p-6">
          <div>
            <h3 className="text-xl font-bold config-heading">Editar Nicho da Empresa</h3>
            <p className="text-sm config-text-muted mt-1">{company.name}</p>
          </div>
          <button
            onClick={onClose}
            className="config-text-muted hover:text-(--color-heading) transition rounded-lg p-2"
          >
            <FiX className="text-xl" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Nicho Atual */}
          <div>
            <h4 className="text-sm font-semibold config-heading mb-2">
              Nicho Atual:
            </h4>
            <IndustryBadge industry={company.industry} size="md" />
          </div>

          {/* Seletor de Nicho */}
          <div>
            <label className="block text-sm font-semibold config-heading mb-3">
              Selecione o Novo Nicho:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INDUSTRY_OPTIONS.map((industryOption) => {
                const Icon = industryOption.icon;
                const isSelected = selectedIndustry === industryOption.value;
                
                return (
                  <button
                    key={industryOption.value}
                    onClick={() => setSelectedIndustry(industryOption.value)}
                    className={`
                      flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                      ${isSelected 
                        ? `${industryOption.color.border} ${industryOption.color.bg} ${industryOption.color.text}` 
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 config-text-muted'
                      }
                    `}
                  >
                    <Icon className="text-2xl shrink-0" />
                    <div className="text-left flex-1">
                      <p className="font-semibold text-sm">{industryOption.label}</p>
                      <p className="text-xs opacity-75 mt-0.5 line-clamp-2">
                        {industryOption.description}
                      </p>
                    </div>
                    {isSelected && <FiCheck className="text-lg shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preview da Seleção */}
          {selectedIndustry !== company.industry && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <FiAlertCircle className="text-blue-600 dark:text-blue-400 text-xl shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    O que acontecerá ao salvar:
                  </p>
                  <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                    <li>O nicho será alterado para <strong>{selectedConfig.label}</strong></li>
                    <li>Configurações do nicho serão aplicadas automaticamente</li>
                    <li>Campos customizados de leads serão atualizados</li>
                    <li>Módulos habilitados serão configurados</li>
                    <li>Templates específicos do nicho ficarão disponíveis</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t config-divider p-6">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm config-text-muted hover:text-(--color-heading) transition rounded-lg"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading || selectedIndustry === company.industry}
            className="flex items-center gap-2 px-6 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Salvando...
              </>
            ) : (
              <>
                <FiCheck />
                Salvar e Aplicar Configurações
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
