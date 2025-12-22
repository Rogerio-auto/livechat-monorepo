import { useCallback, useEffect, useMemo, useState } from "react";
import { API, fetchJson } from "../../utils/api";
import type {
  OpenAIIntegration,
  OpenAIIntegrationUsageLimits,
  OpenAIIntegrationCreatePayload,
  OpenAIIntegrationUpdatePayload,
} from "../../types/types";
import OpenAIIntegrationForm, {
  type OpenAIIntegrationFormSubmit,
} from "./OpenAIIntegrationForm";
import { Button } from "../../components/ui/Button";
import { Modal } from "../../components/ui/Modal";

type FormContext =
  | { mode: "create" }
  | { mode: "edit"; integration: OpenAIIntegration };

type DeleteContext = { integration: OpenAIIntegration } | null;

function normalizeIntegration(row: OpenAIIntegration): OpenAIIntegration {
  return {
    ...row,
    is_active: Boolean(row.is_active),
    updated_at: row.updated_at ?? row.created_at,
    models_allowed: Array.isArray(row.models_allowed)
      ? Array.from(new Set(row.models_allowed.filter((model) => typeof model === "string")))
      : [],
    usage_limits: row.usage_limits ?? {},
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return value;
  }
}

function describeUsage(usage?: OpenAIIntegrationUsageLimits | null): string {
  if (!usage) return "—";
  const parts: string[] = [];
  if (typeof usage.rpm === "number") parts.push(`${usage.rpm} RPM`);
  if (typeof usage.daily_usd_cap === "number")
    parts.push(`$${usage.daily_usd_cap}/dia`);
  return parts.join(" • ") || "—";
}

export default function OpenAIIntegrationCard() {
  const [items, setItems] = useState<OpenAIIntegration[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [formContext, setFormContext] = useState<FormContext | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteContext, setDeleteContext] = useState<DeleteContext>(null);
  const [deleteLoading, setDeleteLoading] = useState<boolean>(false);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) => {
        const aTime = new Date(a.updated_at ?? a.created_at).getTime();
        const bTime = new Date(b.updated_at ?? b.created_at).getTime();
        return bTime - aTime;
      }),
    [items],
  );

  const fetchIntegrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchJson<OpenAIIntegration[]>(`${API}/integrations/openai`);
      setItems(response.map(normalizeIntegration));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar integrações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleFormSubmit = useCallback(
    async (data: OpenAIIntegrationFormSubmit) => {
      setFormSubmitting(true);
      setFormError(null);
      try {
        if (data.mode === "create") {
          const created = await fetchJson<OpenAIIntegration>(`${API}/integrations/openai`, {
            method: "POST",
            body: JSON.stringify(data.payload as OpenAIIntegrationCreatePayload),
          });
          setItems((prev) => [normalizeIntegration(created), ...prev]);
        } else {
          const updated = await fetchJson<OpenAIIntegration>(
            `${API}/integrations/openai/${data.integrationId}`,
            {
              method: "PUT",
              body: JSON.stringify(data.payload as OpenAIIntegrationUpdatePayload),
            },
          );
          setItems((prev) =>
            prev.map((item) => (item.id === updated.id ? normalizeIntegration(updated) : item)),
          );
        }
        setFormContext(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao salvar integração";
        setFormError(message);
        throw err;
      } finally {
        setFormSubmitting(false);
      }
    },
    [],
  );

  async function confirmDelete() {
    if (!deleteContext) return;
    setDeleteLoading(true);
    try {
      await fetchJson<{ ok: true }>(`${API}/integrations/openai/${deleteContext.integration.id}`, {
        method: "DELETE",
      });
      setItems((prev) =>
        prev.filter((item) => item.id !== deleteContext.integration.id),
      );
      setDeleteContext(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao excluir integração";
      setError(message);
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5153-4.9066 6.0462 6.0462 0 0 0-4.4471-3.1243 6.086 6.086 0 0 0-5.4559 1.1892 6.0544 6.0544 0 0 0-5.1327-1.1902 6.0462 6.0462 0 0 0-4.4471 3.1243 5.9847 5.9847 0 0 0-.5153 4.9066 6.0544 6.0544 0 0 0 1.1891 5.4549 5.9847 5.9847 0 0 0 .5153 4.9066 6.0462 6.0462 0 0 0 4.4471 3.1243 6.086 6.086 0 0 0 5.4559-1.1892 6.0544 6.0544 0 0 0 5.1327 1.1902 6.0462 6.0462 0 0 0 4.4471-3.1243 5.9847 5.9847 0 0 0 .5153-4.9066 6.0544 6.0544 0 0 0-1.1891-5.4549zm-9.3138 8.1089a3.1352 3.1352 0 0 1-2.2773-1.2048l.0144-.0085 5.3964-3.1133a.332.332 0 0 0 .166-.2875v-7.5694a3.1277 3.1277 0 0 1 2.8353 2.0517 3.1031 3.1031 0 0 1-.558 3.1531l-.0062.0071-5.3964 3.1133a.3324.3324 0 0 0-.1742.2853v6.683zm-3.6993-1.7736a3.1308 3.1308 0 0 1-.4392-2.5414l.0145.0085 5.3964 3.1133a.332.332 0 0 0 .332 0l6.5565-3.7855a3.1277 3.1277 0 0 1 .0593 3.4921 3.1031 3.1031 0 0 1-2.9173 1.396l-.0094-.0014-5.3964-3.1133a.3324.3324 0 0 0-.332 0l-3.2644 1.8844zm-3.4745-5.4528a3.1352 3.1352 0 0 1 1.8381-1.8381l.0001.0167v6.2266a.332.332 0 0 0 .166.2875l6.5565 3.7855a3.1277 3.1277 0 0 1-2.7759 1.4404 3.1031 3.1031 0 0 1-2.3593-2.1571l-.0031-.0088v-6.2266a.3324.3324 0 0 0-.1581-.2875l-3.2644-1.8844zm-.2166-6.3477a3.1352 3.1352 0 0 1 2.2773 1.2048l-.0144.0085-5.3964 3.1133a.332.332 0 0 0-.166.2875v7.5694a3.1277 3.1277 0 0 1-2.8353-2.0517 3.1031 3.1031 0 0 1 .558-3.1531l.0062-.0071 5.3964-3.1133a.3324.3324 0 0 0 .1742-.2853V2.9559zm3.6993 1.7736a3.1308 3.1308 0 0 1 .4392 2.5414l-.0145-.0085-5.3964-3.1133a.332.332 0 0 0-.332 0L1.5065 7.7346a3.1277 3.1277 0 0 1-.0593-3.4921 3.1031 3.1031 0 0 1 2.9173-1.396l.0094.0014 5.3964 3.1133a.3324.3324 0 0 0 .332 0l3.2644-1.8844zm6.7389 5.4528a3.1352 3.1352 0 0 1-1.8381 1.8381l-.0001-.0167V5.7271a.332.332 0 0 0-.166-.2875L8.7266 1.6541a3.1277 3.1277 0 0 1 2.7759-1.4404 3.1031 3.1031 0 0 1 2.3593 2.1571l.0031.0088v6.2266a.3324.3324 0 0 0 .1581.2875l3.2644 1.8844z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">OpenAI</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Conecte sua conta para habilitar recursos de IA.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchIntegrations()}
            disabled={loading}
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setFormContext({ mode: "create" })}
          >
            Adicionar Conta
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-800 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 font-medium border-b border-gray-100 dark:border-gray-800">
              <th className="px-6 py-4">Nome / Identificação</th>
              <th className="px-6 py-4">Modelo Padrão</th>
              <th className="px-6 py-4">Limites de Uso</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading && sortedItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span>Carregando integrações...</span>
                  </div>
                </td>
              </tr>
            )}

            {!loading && sortedItems.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  Nenhuma conta OpenAI configurada.
                </td>
              </tr>
            )}

            {sortedItems.map((integration) => (
              <tr key={integration.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/20 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-semibold text-gray-900 dark:text-white">{integration.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {integration.org_id ? `Org: ${integration.org_id}` : "Sem Org ID"}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-mono">
                    {integration.default_model || "—"}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                  {describeUsage(integration.usage_limits)}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${
                    integration.is_active 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50' 
                      : 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                  }`}>
                    {integration.is_active ? "Ativa" : "Inativa"}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormContext({ mode: "edit", integration })}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => setDeleteContext({ integration })}
                      disabled={deleteLoading && deleteContext?.integration.id === integration.id}
                    >
                      Excluir
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formContext && (
        <OpenAIIntegrationForm
          open
          mode={formContext.mode}
          integration={formContext.mode === "edit" ? formContext.integration : undefined}
          submitting={formSubmitting}
          error={formError}
          onClose={() => {
            if (!formSubmitting) {
              setFormContext(null);
              setFormError(null);
            }
          }}
          onSubmit={handleFormSubmit}
        />
      )}

      <Modal
        isOpen={!!deleteContext}
        onClose={() => setDeleteContext(null)}
        title="Remover Integração"
      >
        <div className="space-y-4">
          <p className="text-gray-600 dark:text-gray-400">
            Tem certeza que deseja excluir a integração <span className="font-semibold text-gray-900 dark:text-white">{deleteContext?.integration.name}</span>?
            Esta ação não pode ser desfeita e os agentes que dependem desta conta pararão de funcionar.
          </p>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="ghost" onClick={() => setDeleteContext(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

