/**
 * Campaign Validation Alert
 * 
 * Modal/Alert que exibe os resultados da validação de segurança
 * antes de ativar uma campanha (7 pontos de verificação)
 */

import { AlertTriangle, CheckCircle, XCircle, Info } from "lucide-react";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

interface ValidationStats {
  recipient_count: number;
  recipients_without_opt_in: number;
  quality_rating: string | null;
  tier: string | null;
  tier_limit: number | null;
  template_status: string | null;
}

interface ValidationResult {
  safe: boolean;
  critical_issues: string[];
  warnings: string[];
  stats: ValidationStats;
}

interface CampaignValidationAlertProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validation: ValidationResult | null;
  onProceed?: () => void;
  onCancel?: () => void;
}

export function CampaignValidationAlert({
  open,
  onOpenChange,
  validation,
  onProceed,
  onCancel,
}: CampaignValidationAlertProps) {
  if (!validation) return null;

  const hasCriticalIssues = validation.critical_issues.length > 0;
  const hasWarnings = validation.warnings.length > 0;

  const getStatusColor = () => {
    if (hasCriticalIssues) return "text-red-600";
    if (hasWarnings) return "text-yellow-600";
    return "text-green-600";
  };

  const getStatusIcon = () => {
    if (hasCriticalIssues) return XCircle;
    if (hasWarnings) return AlertTriangle;
    return CheckCircle;
  };

  const getStatusLabel = () => {
    if (hasCriticalIssues) return "Campanha Bloqueada";
    if (hasWarnings) return "Atenção Necessária";
    return "Campanha Validada";
  };

  const StatusIcon = getStatusIcon();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <StatusIcon className={`w-6 h-6 ${getStatusColor()}`} />
                {getStatusLabel()}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Validação de segurança em 7 pontos - Sistema 1.000 msgs/dia
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Status Summary */}
          <div className={`p-4 rounded-lg border-2 ${hasCriticalIssues ? "border-red-200 bg-red-50 dark:bg-red-900/20" : hasWarnings ? "border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20" : "border-green-200 bg-green-50 dark:bg-green-900/20"}`}>
            {validation.safe ? (
              <span className="text-green-700 dark:text-green-400 font-medium">
                ✅ Campanha aprovada para ativação
              </span>
            ) : (
              <span className="text-red-700 dark:text-red-400 font-medium">
                ❌ Campanha não pode ser ativada - corrija os problemas abaixo
              </span>
            )}
          </div>

          {/* Statistics */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4" />
              Estatísticas da Campanha
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-gray-600">Recipients:</span>
                <span className="ml-2 font-semibold">{validation.stats.recipient_count}</span>
              </div>
              <div>
                <span className="text-gray-600">Sem opt-in:</span>
                <span className={`ml-2 font-semibold ${validation.stats.recipients_without_opt_in > 0 ? "text-red-600" : "text-green-600"}`}>
                  {validation.stats.recipients_without_opt_in}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Quality Rating:</span>
                <span className={`ml-2 font-semibold ${
                  validation.stats.quality_rating === "GREEN" ? "text-green-600" :
                  validation.stats.quality_rating === "YELLOW" ? "text-yellow-600" :
                  validation.stats.quality_rating === "RED" ? "text-red-600" :
                  "text-gray-600"
                }`}>
                  {validation.stats.quality_rating || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Tier:</span>
                <span className="ml-2 font-semibold">
                  {validation.stats.tier || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Tier Limit:</span>
                <span className="ml-2 font-semibold">
                  {validation.stats.tier_limit?.toLocaleString("pt-BR") || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-gray-600">Template:</span>
                <span className={`ml-2 font-semibold ${
                  validation.stats.template_status === "APPROVED" ? "text-green-600" :
                  validation.stats.template_status === "PENDING" ? "text-yellow-600" :
                  validation.stats.template_status === "REJECTED" ? "text-red-600" :
                  "text-gray-600"
                }`}>
                  {validation.stats.template_status || "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Critical Issues */}
          {hasCriticalIssues && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h3 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                <XCircle className="w-5 h-5" />
                Problemas Críticos ({validation.critical_issues.length})
              </h3>
              <ul className="space-y-2">
                {validation.critical_issues.map((issue, i) => (
                  <li key={i} className="text-sm text-red-700 flex items-start gap-2">
                    <span className="text-red-500 font-bold">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 p-2 bg-red-100 rounded text-xs text-red-800">
                ⚠️ <strong>Ação necessária:</strong> Corrija todos os problemas críticos antes de ativar a campanha.
              </div>
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Avisos ({validation.warnings.length})
              </h3>
              <ul className="space-y-2">
                {validation.warnings.map((warning, i) => (
                  <li key={i} className="text-sm text-yellow-700 flex items-start gap-2">
                    <span className="text-yellow-500 font-bold">•</span>
                    <span>{warning}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 p-2 bg-yellow-100 rounded text-xs text-yellow-800">
                ℹ️ <strong>Recomendação:</strong> Revise os avisos antes de prosseguir. A campanha pode ser ativada, mas considere as advertências.
              </div>
            </div>
          )}

          {/* Success Message */}
          {validation.safe && !hasWarnings && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 dark:text-green-400 mb-2 flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Validação Completa
              </h3>
              <p className="text-sm text-green-700 dark:text-green-400">
                ✅ Todos os requisitos de segurança foram atendidos. A campanha está pronta para ser ativada.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => {
                onCancel?.();
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button
              disabled={hasCriticalIssues}
              onClick={() => {
                onProceed?.();
                onOpenChange(false);
              }}
              className={hasCriticalIssues ? "bg-gray-400" : hasWarnings ? "bg-yellow-600 hover:bg-yellow-700" : "bg-green-600 hover:bg-green-700"}
            >
              {hasCriticalIssues ? "Bloqueado" : hasWarnings ? "Ativar Mesmo Assim" : "Ativar Campanha"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
