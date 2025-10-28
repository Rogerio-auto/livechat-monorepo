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

const CARD_CLASS = "config-card rounded-2xl shadow-sm p-6 config-text-muted";
const TITLE_CLASS = "text-xl font-semibold config-heading";
const PRIMARY_BTN =
  "config-btn-primary px-3 py-2 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition";
const SOFT_BTN = "config-btn px-3 py-2 rounded-lg disabled:opacity-60";
const BADGE_BASE = "config-badge inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";

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
    <section className={CARD_CLASS}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={TITLE_CLASS}>OpenAI</h2>
          <p className="text-sm config-text-muted">
            Gerencie tokens e modelos permitidos para os agentes inteligentes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SOFT_BTN}
            onClick={() => fetchIntegrations()}
            disabled={loading}
          >
            {loading ? "Atualizando..." : "Recarregar"}
          </button>
          <button
            type="button"
            className={PRIMARY_BTN}
            onClick={() => setFormContext({ mode: "create" })}
          >
            Nova integração
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
        <table className="w-full border-collapse text-sm">
        <thead className="text-xs uppercase tracking-wide config-text-muted">
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
                <td colSpan={7} className="px-4 py-6 text-center config-text-muted">
                  Carregando integrações...
                </td>
              </tr>
            )}

            {!loading && sortedItems.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center config-text-muted">
                  Nenhuma integração configurada ainda.
                </td>
              </tr>
            )}

            {sortedItems.map((integration) => (
            <tr
              key={integration.id}
              className="border-t theme-border transition-colors hover:bg-[var(--color-surface-muted)]"
            >
                <td className="px-4 py-3">
                  <div className="font-medium config-heading">{integration.name}</div>
                  <div className="text-xs config-text-muted">
                    {integration.org_id ? `Org: ${integration.org_id}` : "—"}
                    {integration.project_id ? ` • Projeto: ${integration.project_id}` : ""}
                  </div>
                </td>
                <td className="px-4 py-3 config-text-muted">
                  {integration.default_model || "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(integration.models_allowed ?? []).length > 0 ? (
                      (integration.models_allowed ?? []).map((model) => (
                        <span
                          key={model}
                          className="config-chip config-chip--muted inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                        >
                          {model}
                        </span>
                      ))
                    ) : (
                      <span className="config-text-muted">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 config-text-muted">
                  {describeUsage(integration.usage_limits)}
                </td>
                <td className="px-4 py-3 config-text-muted">{formatDate(integration.updated_at)}</td>
                <td className="px-4 py-3">
                  <span
                    className={`${BADGE_BASE} ${
                      integration.is_active
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-zinc-500/15 text-zinc-300"
                    }`}
                  >
                    {integration.is_active ? "Ativa" : "Desativada"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className={SOFT_BTN}
                      onClick={() => setFormContext({ mode: "edit", integration })}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 disabled:opacity-60"
                      onClick={() => setDeleteContext({ integration })}
                      disabled={deleteLoading && deleteContext?.integration.id === integration.id}
                    >
                      Excluir
                    </button>
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[var(--color-overlay)] px-4">
          <div className="config-modal w-full max-w-md rounded-2xl p-6 config-text-muted">
            <h3 className="text-lg font-semibold config-heading mb-2">Remover integração</h3>
            <p className="text-sm config-text-muted mb-4">
              Tem certeza que deseja excluir a integração{" "}
              <span className="config-heading font-medium">{deleteContext.integration.name}</span>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={SOFT_BTN}
                onClick={() => setDeleteContext(null)}
                disabled={deleteLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-60"
                onClick={confirmDelete}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
