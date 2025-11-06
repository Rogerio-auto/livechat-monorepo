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
import { Button } from "../../components/ui";

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
    return new Date(value).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

function describeUsage(usage?: OpenAIIntegrationUsageLimits | null): string {
  if (!usage) return "—";
  const parts: string[] = [];
  if (typeof usage.rpm === "number") parts.push(`${usage.rpm} rpm`);
  if (typeof usage.daily_usd_cap === "number")
    parts.push(`US$ ${usage.daily_usd_cap}/dia`);
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
    <section className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg transition-colors duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">OpenAI</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Gerencie tokens e modelos permitidos para os agentes inteligentes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchIntegrations()}
            disabled={loading}
          >
            {loading ? "Atualizando..." : "Recarregar"}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setFormContext({ mode: "create" })}
          >
            Nova integração
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-100 dark:bg-gray-800/50 text-xs uppercase tracking-wide text-gray-600 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Nome</th>
              <th className="px-4 py-3 text-left font-semibold">Modelo padrão</th>
              <th className="px-4 py-3 text-left font-semibold">Modelos permitidos</th>
              <th className="px-4 py-3 text-left font-semibold">Limites</th>
              <th className="px-4 py-3 text-left font-semibold">Atualizado em</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && sortedItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-600 dark:text-gray-400">
                  Carregando integrações...
                </td>
              </tr>
            )}

            {!loading && sortedItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-gray-600 dark:text-gray-400">
                  Nenhuma integração configurada ainda.
                </td>
              </tr>
            )}

            {sortedItems.map((integration) => (
            <tr
              key={integration.id}
              className="border-t border-gray-200 dark:border-gray-700 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800/50"
            >
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900 dark:text-white">{integration.name}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {integration.org_id ? `Org: ${integration.org_id}` : "—"}
                    {integration.project_id ? ` • Projeto: ${integration.project_id}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {integration.default_model || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(integration.models_allowed ?? []).length > 0 ? (
                      (integration.models_allowed ?? []).map((model) => (
                        <span
                          key={model}
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                        >
                          {model}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-600 dark:text-gray-400">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                  {describeUsage(integration.usage_limits)}
                </td>
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatDate(integration.updated_at)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                      integration.is_active
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    {integration.is_active ? "Ativa" : "Desativada"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormContext({ mode: "edit", integration })}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
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

      {deleteContext && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-6 shadow-2xl transition-colors duration-300">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Remover integração</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
              Tem certeza que deseja excluir a integração{" "}
              <span className="font-medium text-gray-900 dark:text-white">{deleteContext.integration.name}</span>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDeleteContext(null)}
                disabled={deleteLoading}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Excluindo..." : "Excluir"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
