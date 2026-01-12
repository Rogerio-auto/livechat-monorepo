import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { API, fetchJson } from "../../utils/api";
import type {
  AutomationAgent,
  AutomationAgentPayload,
  AgentStatus,
  OpenAIIntegration,
  AgentTemplate,
  AgentTemplateQuestion,
  AgentTemplatePreview,
} from "@livechat/shared";
import { OPENAI_MODEL_OPTIONS } from "../integrations/OpenAIIntegrationForm";

const CARD_CLASS = "config-card rounded-xl shadow-sm p-6 config-text-muted";
const TITLE_CLASS = "text-xl font-semibold config-heading";
const PRIMARY_BTN =
  "config-btn-primary px-3 py-2 rounded-lg disabled:opacity-60 disabled:cursor-not-allowed transition";
const SOFT_BTN = "config-btn px-3 py-2 rounded-lg disabled:opacity-60";
const BADGE_BASE = "config-badge inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold";

const INPUT_BASE = "config-input w-full rounded-xl px-3 py-2 disabled:opacity-70";
const TEXTAREA_BASE = "config-input w-full min-h-[120px] rounded-xl px-3 py-2 disabled:opacity-70";
const LABEL = "block text-sm config-text-muted mb-1";

const STATUS_LABEL: Record<AgentStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  ARCHIVED: "Arquivado",
  ERROR: "Erro",
};

type OpenAIModelOption = (typeof OPENAI_MODEL_OPTIONS)[number];

const OPENAI_AUDIO_TRANSCRIBE_MODELS: string[] = [
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "whisper-1",
];

const OPENAI_VISION_MODELS: string[] = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4.1",
  "gpt-4.1-mini",
  "o1-mini",
];

const withCustomOption = (options: readonly string[], value: string) => {
  if (!value || options.includes(value)) return options;
  return [...options, value];
};

type FormContext =
  | { mode: "create" }
  | { mode: "edit"; agent: AutomationAgent };

type AgentFormSubmit =
  | { mode: "create"; payload: AutomationAgentPayload }
  | { mode: "edit"; agentId: string; payload: Partial<AutomationAgentPayload> };

type AgentFormProps = {
  open: boolean;
  mode: FormContext["mode"];
  agent?: AutomationAgent;
  integrations: OpenAIIntegration[];
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: AgentFormSubmit) => Promise<void>;
};

type AgentFormState = {
  name: string;
  description: string;
  status: AgentStatus;
  integration_openai_id: string;
  model: string;
  model_params: string;
  aggregation_enabled: boolean;
  aggregation_window_sec: string;
  max_batch_messages: string;
  reply_if_idle_sec: string;
  media_audio_transcribe_model: string;
  media_audio_language: string;
  media_image_vision_model: string;
  media_image_max_images: string;
  allow_internal_db: boolean;
  allow_http: boolean;
  allow_n8n: boolean;
  allow_handoff: boolean;
};

function normalizeAgent(row: AutomationAgent): AutomationAgent {
  return {
    ...row,
    status: row.status ?? "ACTIVE",
    integration_openai_id: row.integration_openai_id ?? null,
    aggregation_enabled: row.aggregation_enabled ?? true,
    aggregation_window_sec:
      typeof row.aggregation_window_sec === "number"
        ? row.aggregation_window_sec
        : null,
    max_batch_messages:
      typeof row.max_batch_messages === "number" ? row.max_batch_messages : null,
    reply_if_idle_sec:
      typeof row.reply_if_idle_sec === "number" ? row.reply_if_idle_sec : null,
    media_config: row.media_config ?? {},
    tools_policy: row.tools_policy ?? {},
    allow_handoff: row.allow_handoff ?? true,
  };
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const time = Number(new Date(value).getTime());
  if (!Number.isFinite(time)) return "-";
  return new Date(time).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function stableStringify(value: unknown): string {
  if (value === undefined) return "undefined";
  const seen = new WeakSet();
  return JSON.stringify(
    value,
    function replacer(_key, val) {
      if (val && typeof val === "object") {
        if (seen.has(val)) return;
        seen.add(val);
        return Object.keys(val)
          .sort()
          .reduce<Record<string, unknown>>((acc, current) => {
            acc[current] = (val as Record<string, unknown>)[current];
            return acc;
          }, {});
      }
      return val;
    },
  );
}

function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true;
  if (typeof a === "object" || typeof b === "object") {
    return stableStringify(a) === stableStringify(b);
  }
  return false;
}

function setPatchValue<K extends keyof AutomationAgentPayload>(
  target: Partial<AutomationAgentPayload>,
  key: K,
  value: AutomationAgentPayload[K],
): void {
  target[key] = value;
}

function buildPayloadFromForm(state: AgentFormState): AutomationAgentPayload {
  const trimmedName = state.name.trim();
  if (!trimmedName) {
    throw new Error("Nome obrigatorio");
  }

  const description = state.description.trim();
  const model = state.model.trim();
  const aggregationWindow = Number(state.aggregation_window_sec);
  const maxBatch = Number(state.max_batch_messages);
  const replyIdle = state.reply_if_idle_sec.trim();

  let parsedModelParams: Record<string, unknown> | undefined;
  if (state.model_params.trim()) {
    parsedModelParams = JSON.parse(state.model_params.trim());
    if (!parsedModelParams || typeof parsedModelParams !== "object") {
      throw new Error("Model params precisa ser JSON");
    }
  }

  const mediaConfig: Record<string, unknown> = {};
  const audio: Record<string, unknown> = {};
  if (state.media_audio_transcribe_model.trim()) {
    audio.transcribe_model = state.media_audio_transcribe_model.trim();
  }
  if (state.media_audio_language.trim()) {
    audio.language = state.media_audio_language.trim();
  }
  if (Object.keys(audio).length > 0) mediaConfig.AUDIO = audio;

  const image: Record<string, unknown> = {};
  if (state.media_image_vision_model.trim()) {
    image.vision_model = state.media_image_vision_model.trim();
  }
  if (state.media_image_max_images.trim()) {
    const parsed = Number(state.media_image_max_images.trim());
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new Error("max_images invalido");
    }
    image.max_images = parsed;
  }
  if (Object.keys(image).length > 0) mediaConfig.IMAGE = image;

  const toolsPolicy: Record<string, unknown> = {
    allow_internal_db: state.allow_internal_db,
    allow_http: state.allow_http,
    allow_n8n: state.allow_n8n,
  };

  const payload: AutomationAgentPayload = {
    name: trimmedName,
    status: state.status,
    aggregation_enabled: state.aggregation_enabled,
    aggregation_window_sec: Number.isFinite(aggregationWindow)
      ? aggregationWindow
      : 20,
    max_batch_messages: Number.isFinite(maxBatch) ? maxBatch : 20,
    allow_handoff: state.allow_handoff,
    tools_policy: toolsPolicy,
  };

  if (description) payload.description = description;
  payload.model_params = parsedModelParams ?? {};
  if (model) payload.model = model;

  payload.integration_openai_id = state.integration_openai_id
    ? state.integration_openai_id
    : null;

  if (replyIdle) {
    const parsedReply = Number(replyIdle);
    if (!Number.isFinite(parsedReply) || parsedReply < 0) {
      throw new Error("reply_if_idle_sec invalido");
    }
    payload.reply_if_idle_sec = parsedReply;
  } else {
    payload.reply_if_idle_sec = null;
  }

  payload.media_config = Object.keys(mediaConfig).length > 0 ? mediaConfig : {};

  return payload;
}

function buildFormState(agent?: AutomationAgent): AgentFormState {
  const normalized = agent ? normalizeAgent(agent) : undefined;
  return {
    name: normalized?.name ?? "",
    description: normalized?.description ?? "",
    status: normalized?.status ?? "ACTIVE",
    integration_openai_id: normalized?.integration_openai_id ?? "",
    model: normalized?.model ?? "",
    model_params: normalized?.model_params
      ? JSON.stringify(normalized.model_params, null, 2)
      : "",
    aggregation_enabled: normalized?.aggregation_enabled ?? true,
    aggregation_window_sec:
      normalized?.aggregation_window_sec !== null &&
      normalized?.aggregation_window_sec !== undefined
        ? String(normalized.aggregation_window_sec)
        : "20",
    max_batch_messages:
      normalized?.max_batch_messages !== null &&
      normalized?.max_batch_messages !== undefined
        ? String(normalized.max_batch_messages)
        : "20",
    reply_if_idle_sec:
      normalized?.reply_if_idle_sec !== null &&
      normalized?.reply_if_idle_sec !== undefined
        ? String(normalized.reply_if_idle_sec)
        : "",
    media_audio_transcribe_model:
      (normalized?.media_config as any)?.AUDIO?.transcribe_model ?? "",
    media_audio_language: (normalized?.media_config as any)?.AUDIO?.language ?? "",
    media_image_vision_model:
      (normalized?.media_config as any)?.IMAGE?.vision_model ?? "",
    media_image_max_images:
      (normalized?.media_config as any)?.IMAGE?.max_images !== undefined
        ? String((normalized?.media_config as any)?.IMAGE?.max_images)
        : "",
    allow_internal_db:
      Boolean((normalized?.tools_policy as any)?.allow_internal_db) ?? false,
    allow_http: Boolean((normalized?.tools_policy as any)?.allow_http) ?? false,
    allow_n8n: Boolean((normalized?.tools_policy as any)?.allow_n8n) ?? false,
    allow_handoff: normalized?.allow_handoff ?? true,
  };
}

function buildPayloadFromAgent(agent: AutomationAgent): AutomationAgentPayload {
  const normalized = normalizeAgent(agent);
  return {
    name: normalized.name,
    description: normalized.description ?? undefined,
    status: normalized.status ?? "ACTIVE",
    integration_openai_id: normalized.integration_openai_id ?? null,
    model: normalized.model ?? undefined,
    model_params: normalized.model_params ?? {},
    aggregation_enabled: normalized.aggregation_enabled ?? true,
    aggregation_window_sec: normalized.aggregation_window_sec ?? 20,
    max_batch_messages: normalized.max_batch_messages ?? 20,
    reply_if_idle_sec:
      normalized.reply_if_idle_sec === null ? null : normalized.reply_if_idle_sec ?? null,
    media_config: normalized.media_config ?? {},
    tools_policy: normalized.tools_policy ?? {},
    allow_handoff: normalized.allow_handoff ?? true,
  };
}

function AgentFormModal({
  open,
  mode,
  agent,
  integrations,
  submitting = false,
  error,
  onClose,
  onSubmit,
}: AgentFormProps) {
  const [state, setState] = useState<AgentFormState>(() => buildFormState(agent));
  const [validationError, setValidationError] = useState<string | null>(null);
  const [customModelMode, setCustomModelMode] = useState<boolean>(() => {
    const initial = buildFormState(agent);
    return Boolean(
      initial.model &&
        !OPENAI_MODEL_OPTIONS.includes(initial.model as OpenAIModelOption),
    );
  });

  useEffect(() => {
    if (open) {
      const nextState = buildFormState(agent);
      setState(nextState);
      setValidationError(null);
      setCustomModelMode(
        Boolean(
          nextState.model &&
            !OPENAI_MODEL_OPTIONS.includes(nextState.model as OpenAIModelOption),
        ),
      );
    }
  }, [open, agent]);

  if (!open) return null;

  const submit = async () => {
    try {
      const payload = buildPayloadFromForm(state);
      if (mode === "create") {
        await onSubmit({ mode: "create", payload });
        return;
      }
      if (!agent) return;
      const original = buildPayloadFromAgent(agent);
      const patch: Partial<AutomationAgentPayload> = {};
      let changed = false;
      const keys = new Set([
        ...Object.keys(payload),
        ...Object.keys(original),
      ]) as Set<keyof AutomationAgentPayload>;
      for (const key of keys) {
        const nextValue = payload[key];
        const prevValue = original[key];
        if (isEqual(nextValue, prevValue)) continue;
        if (nextValue === undefined) continue;
        setPatchValue(
          patch,
          key,
          nextValue as AutomationAgentPayload[keyof AutomationAgentPayload],
        );
        changed = true;
      }
      if (!changed) {
        setValidationError("Nenhuma alteracao para salvar.");
        return;
      }
      await onSubmit({ mode: "edit", agentId: agent.id, payload: patch });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro de validacao.";
      setValidationError(message);
    }
  };

  const field = (label: string, element: ReactElement, key?: string) => (
    <div key={key}>
      <label className={LABEL}>{label}</label>
      {element}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-3xl rounded-xl border border-white/10 bg-[#0F172A] text-[#94A3B8] shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-white/5 p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">
              {mode === "create" ? "Novo agente" : "Editar agente"}
            </h2>
            <p className="text-sm">Configure o comportamento do agente inteligente.</p>
          </div>
          <button
            type="button"
            className="text-[#94A3B8] hover:text-white transition"
            onClick={() => !submitting && onClose()}
            disabled={submitting}
          >
            &times;
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-4">
          {validationError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {validationError}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {field(
              "Nome *",
              <input
                className={INPUT_BASE}
                value={state.name}
                onChange={(event) => setState((prev) => ({ ...prev, name: event.target.value }))}
                disabled={submitting}
                placeholder="Agente IA"
              />,
              "name",
            )}
            {field(
              "Status",
              <select
                className={INPUT_BASE}
                value={state.status}
                onChange={(event) =>
                  setState((prev) => ({
                    ...prev,
                    status: event.target.value as AgentStatus,
                  }))
                }
                disabled={submitting}
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
                <option value="ARCHIVED">Arquivado</option>
              </select>,
              "status",
            )}
          </div>

          {field(
            "Descricao",
            <textarea
              className={TEXTAREA_BASE}
              value={state.description}
              onChange={(event) =>
                setState((prev) => ({ ...prev, description: event.target.value }))
              }
              disabled={submitting}
              placeholder="Contexto, persona, objetivo"
            />,
            "description",
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {field(
              "Integracao OpenAI",
              <select
                className={INPUT_BASE}
                value={state.integration_openai_id}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, integration_openai_id: event.target.value }))
                }
                disabled={submitting}
              >
                <option value="">Sem integracao</option>
                {integrations.map((integration) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.name}
                  </option>
                ))}
              </select>,
              "integration",
            )}
              {field(
                "Modelo",
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {Array.from(OPENAI_MODEL_OPTIONS).map((option) => {
                      const active = !customModelMode && state.model === option;
                      return (
                        <button
                          type="button"
                          key={option}
                          className={`px-3 py-1.5 rounded-lg text-xs transition ${
                            active ? "bg-[#1D4ED8] text-white" : "bg-white/5 text-[#94A3B8]"
                          }`}
                          onClick={() => {
                            setState((prev) => ({ ...prev, model: option }));
                            setCustomModelMode(false);
                          }}
                          disabled={submitting}
                        >
                          {option}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      className={`px-3 py-1.5 rounded-lg text-xs transition ${
                        customModelMode ? "bg-[#1D4ED8] text-white" : "bg-white/5 text-[#94A3B8]"
                      }`}
                      onClick={() => {
                        setCustomModelMode(true);
                        setState((prev) => ({
                          ...prev,
                          model:
                            prev.model &&
                            !OPENAI_MODEL_OPTIONS.includes(prev.model as OpenAIModelOption)
                              ? prev.model
                              : "",
                        }));
                      }}
                      disabled={submitting}
                    >
                      Outro
                    </button>
                  </div>
                  {customModelMode && (
                    <input
                      className={INPUT_BASE}
                      value={state.model}
                      onChange={(event) =>
                        setState((prev) => ({ ...prev, model: event.target.value }))
                      }
                      disabled={submitting}
                      placeholder="Informe manualmente (ex: gpt-4o-realtime-preview)"
                    />
                  )}
                  {!state.model && (
                    <p className="text-xs text-[#64748B]">
                      Selecione um modelo para o agente responder.
                    </p>
                  )}
                </div>,
                "model",
              )}
          </div>

          {field(
            "Model params (JSON)",
            <textarea
              className={TEXTAREA_BASE}
              value={state.model_params}
              onChange={(event) =>
                setState((prev) => ({ ...prev, model_params: event.target.value }))
              }
              disabled={submitting}
              placeholder='Ex: { "temperature": 0.7 }'
            />,
            "model_params",
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="inline-flex items-center gap-2 text-sm text-[#94A3B8]">
              <input
                type="checkbox"
                checked={state.aggregation_enabled}
                onChange={(event) =>
                  setState((prev) => ({ ...prev, aggregation_enabled: event.target.checked }))
                }
                disabled={submitting}
              />
              Agregacao de mensagens
            </label>
            <div className="grid gap-4 md:grid-cols-2">
              {field(
                "Janela (seg)",
                <input
                  className={INPUT_BASE}
                  value={state.aggregation_window_sec}
                  onChange={(event) =>
                    setState((prev) => ({ ...prev, aggregation_window_sec: event.target.value }))
                  }
                  disabled={submitting}
                  type="number"
                  min={1}
                />,
                "agg_window",
              )}
              {field(
                "Batch max",
                <input
                  className={INPUT_BASE}
                  value={state.max_batch_messages}
                  onChange={(event) =>
                    setState((prev) => ({ ...prev, max_batch_messages: event.target.value }))
                  }
                  disabled={submitting}
                  type="number"
                  min={1}
                />,
                "agg_batch",
              )}
            </div>
          </div>

          {field(
            "Responder se cliente ficar ocioso (seg)",
            <input
              className={INPUT_BASE}
              value={state.reply_if_idle_sec}
              onChange={(event) =>
                setState((prev) => ({ ...prev, reply_if_idle_sec: event.target.value }))
              }
              disabled={submitting}
              type="number"
              min={0}
              placeholder="Deixe vazio para desativar"
            />,
            "reply_idle",
          )}

          <div>
            <span className="text-sm font-medium text-white">Interpretacao de midias</span>
            <div className="mt-3 space-y-4">
              <div className="rounded-xl border border-white/10 bg-[#0B1324] p-4">
                <h4 className="text-sm font-semibold text-white mb-3">Áudio</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {field(
                    "Transcribe model",
                    <select
                      className={INPUT_BASE}
                      value={state.media_audio_transcribe_model}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          media_audio_transcribe_model: event.target.value,
                        }))
                      }
                      disabled={submitting}
                    >
                      <option value="">Selecione um modelo</option>
                      {withCustomOption(
                        OPENAI_AUDIO_TRANSCRIBE_MODELS,
                        state.media_audio_transcribe_model,
                      ).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>,
                    "audio_model",
                  )}
                  {field(
                    "Idioma",
                    <input
                      className={INPUT_BASE}
                      value={state.media_audio_language}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          media_audio_language: event.target.value,
                        }))
                      }
                      disabled={submitting}
                      placeholder="pt-BR"
                    />,
                    "audio_language",
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0B1324] p-4">
                <h4 className="text-sm font-semibold text-white mb-3">Imagem</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  {field(
                    "Vision model",
                    <select
                      className={INPUT_BASE}
                      value={state.media_image_vision_model}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          media_image_vision_model: event.target.value,
                        }))
                      }
                      disabled={submitting}
                    >
                      <option value="">Selecione um modelo</option>
                      {withCustomOption(
                        OPENAI_VISION_MODELS,
                        state.media_image_vision_model,
                      ).map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>,
                    "image_model",
                  )}
                  {field(
                    "Max imagens",
                    <input
                      className={INPUT_BASE}
                      value={state.media_image_max_images}
                      onChange={(event) =>
                        setState((prev) => ({
                          ...prev,
                          media_image_max_images: event.target.value,
                        }))
                      }
                      disabled={submitting}
                      type="number"
                      min={0}
                    />,
                    "image_max",
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-[#0B1324] p-4">
              <h4 className="text-sm font-semibold text-white mb-2">Permissoes</h4>
              <label className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <input
                  type="checkbox"
                  checked={state.allow_internal_db}
                  onChange={(event) =>
                    setState((prev) => ({ ...prev, allow_internal_db: event.target.checked }))
                  }
                  disabled={submitting}
                />
                Banco interno
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm text-[#94A3B8]">
                <input
                  type="checkbox"
                  checked={state.allow_http}
                  onChange={(event) =>
                    setState((prev) => ({ ...prev, allow_http: event.target.checked }))
                  }
                  disabled={submitting}
                />
                HTTP externo
              </label>
              <label className="mt-2 flex items-center gap-2 text-sm text-[#94A3B8]">
                <input
                  type="checkbox"
                  checked={state.allow_n8n}
                  onChange={(event) =>
                    setState((prev) => ({ ...prev, allow_n8n: event.target.checked }))
                  }
                  disabled={submitting}
                />
                n8n
              </label>
            </div>
            <div className="rounded-xl border border-white/10 bg-[#0B1324] p-4">
              <h4 className="text-sm font-semibold text-white mb-2">Encaminhamento</h4>
              <label className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <input
                  type="checkbox"
                  checked={state.allow_handoff}
                  onChange={(event) =>
                    setState((prev) => ({ ...prev, allow_handoff: event.target.checked }))
                  }
                  disabled={submitting}
                />
                Permitir handoff
              </label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/5 p-6">
          <button type="button" className={SOFT_BTN} onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button type="button" className={PRIMARY_BTN} onClick={submit} disabled={submitting}>
            {submitting ? "Salvando..." : "Salvar agente"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AgentsPanel() {
  const [agents, setAgents] = useState<AutomationAgent[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);

  const [integrations, setIntegrations] = useState<OpenAIIntegration[]>([]);
  const [integrationsLoading, setIntegrationsLoading] = useState(false);

  const [formContext, setFormContext] = useState<FormContext | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AutomationAgent | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const sortedAgents = useMemo(
    () =>
      [...agents].sort((a, b) => {
        const aTime = new Date(a.updated_at ?? a.created_at).getTime();
        const bTime = new Date(b.updated_at ?? b.created_at).getTime();
        return bTime - aTime;
      }),
    [agents],
  );

  const activeIntegrations = useMemo(
    () => integrations.filter((integration) => integration.is_active),
    [integrations],
  );

  const integrationsMap = useMemo(() => {
    const map = new Map<string, OpenAIIntegration>();
    integrations.forEach((integration) => map.set(integration.id, integration));
    return map;
  }, [integrations]);

  const loadAgents = useCallback(async () => {
    setAgentsLoading(true);
    setAgentsError(null);
    try {
      const response = await fetchJson<AutomationAgent[]>(`${API}/agents`);
      setAgents(response.map(normalizeAgent));
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : "Erro ao carregar agentes");
    } finally {
      setAgentsLoading(false);
    }
  }, []);

  const loadIntegrations = useCallback(async () => {
    setIntegrationsLoading(true);
    try {
      const response = await fetchJson<OpenAIIntegration[]>(`${API}/integrations/openai`);
      setIntegrations(response.map((item) => ({ ...item, is_active: Boolean(item.is_active) })));
    } catch {
      setIntegrations([]);
    } finally {
      setIntegrationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
    loadIntegrations();
  }, [loadAgents, loadIntegrations]);

  const handleFormSubmit = useCallback(
    async (payload: AgentFormSubmit) => {
      setFormSubmitting(true);
      setFormError(null);
      try {
        if (payload.mode === "create") {
          const created = await fetchJson<AutomationAgent>(`${API}/agents`, {
            method: "POST",
            body: JSON.stringify(payload.payload),
          });
          setAgents((prev) => [normalizeAgent(created), ...prev]);
        } else {
          const updated = await fetchJson<AutomationAgent>(`${API}/agents/${payload.agentId}`, {
            method: "PUT",
            body: JSON.stringify(payload.payload),
          });
          setAgents((prev) =>
            prev.map((agent) => (agent.id === updated.id ? normalizeAgent(updated) : agent)),
          );
        }
        setFormContext(null);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao salvar agente";
        setFormError(message);
        throw err;
      } finally {
        setFormSubmitting(false);
      }
    },
    [],
  );

  const confirmDeleteAgent = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await fetchJson<{ ok: true }>(`${API}/api/agents/${deleteTarget.id}`, { method: "DELETE" });
      setAgents((prev) => prev.filter((agent) => agent.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setAgentsError(err instanceof Error ? err.message : "Erro ao excluir agente");
    } finally {
      setDeleteLoading(false);
    }
  }, [deleteTarget]);

  return (
    <section className={CARD_CLASS}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={TITLE_CLASS}>Agentes</h2>
          <p className="text-sm text-[#94A3B8]">
            Defina personas, modelos e permissoes para automacoes assistidas por IA.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={SOFT_BTN}
            onClick={() => {
              loadAgents();
              loadIntegrations();
            }}
            disabled={agentsLoading || integrationsLoading}
          >
            {agentsLoading ? "Atualizando..." : "Recarregar"}
          </button>
          <button
            type="button"
            className={PRIMARY_BTN}
            onClick={() => setFormContext({ mode: "create" })}
          >
            Novo agente
          </button>
          <button
            type="button"
            className={PRIMARY_BTN}
            onClick={() => setWizardOpen(true)}
          >
            Novo agente (assistido)
          </button>
        </div>
      </div>

      {agentsError && (
        <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {agentsError}
        </div>
      )}

      <div className="mt-6 space-y-4">
        {agentsLoading && sortedAgents.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-[#94A3B8]">
            Carregando agentes...
          </div>
        )}
        {!agentsLoading && sortedAgents.length === 0 && (
          <div className="rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-6 text-center text-sm text-[#94A3B8]">
            Nenhum agente configurado ainda. Clique em "Novo agente" para comecar.
          </div>
        )}
        {sortedAgents.map((agent) => {
          const integrationName = agent.integration_openai_id
            ? integrationsMap.get(agent.integration_openai_id)?.name ?? "Integracao removida"
            : "Sem integracao";
          return (
            <div
              key={agent.id}
              className="rounded-xl border border-white/10 bg-white/5 p-5 text-[#94A3B8]"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                    <span
                      className={`${BADGE_BASE} ${
                        agent.status === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-200"
                          : agent.status === "INACTIVE"
                            ? "bg-amber-500/15 text-amber-200"
                            : "bg-zinc-500/15 text-zinc-200"
                      }`}
                    >
                      {STATUS_LABEL[(agent.status as AgentStatus) ?? "ACTIVE"]}
                    </span>
                  </div>
                  {agent.description && (
                    <p className="mt-1 text-sm text-[#94A3B8]">{agent.description}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-[#94A3B8]">
                    <span>
                      <span className="text-white/80">Integracao:</span> {integrationName}
                    </span>
                    <span>
                      <span className="text-white/80">Modelo:</span>{" "}
                      {agent.model ?? (agent.model_params as any)?.model ?? "Sem modelo"}
                    </span>
                    <span>
                      <span className="text-white/80">Atualizado:</span>{" "}
                      {formatDate(agent.updated_at)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={SOFT_BTN}
                    onClick={() => setFormContext({ mode: "edit", agent })}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 disabled:opacity-60"
                    onClick={() => setDeleteTarget(agent)}
                    disabled={deleteLoading && deleteTarget?.id === agent.id}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {formContext && (
        <AgentFormModal
          open
          mode={formContext.mode}
          agent={formContext.mode === "edit" ? formContext.agent : undefined}
          integrations={activeIntegrations}
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

      {deleteTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#0F172A] p-6 text-[#94A3B8]">
            <h3 className="text-lg font-semibold text-white mb-2">Excluir agente</h3>
            <p className="text-sm mb-4">
              Deseja remover o agente {deleteTarget.name}? Essa acao nao pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className={SOFT_BTN}
                onClick={() => setDeleteTarget(null)}
                disabled={deleteLoading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-3 py-2 rounded-lg bg-red-500/20 text-red-200 hover:bg-red-500/30 disabled:opacity-60"
                onClick={confirmDeleteAgent}
                disabled={deleteLoading}
              >
                {deleteLoading ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      {wizardOpen && (
        <AgentWizardModal
          open
          integrations={activeIntegrations}
          onClose={() => setWizardOpen(false)}
          onCreated={(created) => {
            setAgents((prev) => [created, ...prev]);
            setWizardOpen(false);
          }}
        />
      )}
    </section>
  );
}

type WizardProps = {
  open: boolean;
  integrations: OpenAIIntegration[];
  onClose: () => void;
  onCreated: (agent: AutomationAgent) => void;
};

function AgentWizardModal({ open, integrations, onClose, onCreated }: WizardProps) {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);
  const [selectedTplId, setSelectedTplId] = useState<string>("");
  const [selectedTpl, setSelectedTpl] = useState<AgentTemplate | null>(null);
  const [questions, setQuestions] = useState<AgentTemplateQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [preview, setPreview] = useState<AgentTemplatePreview | null>(null);
  const [name, setName] = useState("");
  const [integrationId, setIntegrationId] = useState("");
  const [modelOverride, setModelOverride] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setTplLoading(true);
      setTplError(null);
      try {
        const list = await fetchJson<AgentTemplate[]>(`${API}/agent-templates`);
        setTemplates(list);
      } catch (err) {
        setTplError(err instanceof Error ? err.message : "Falha ao carregar templates");
      } finally {
        setTplLoading(false);
      }
    };
    load();
  }, [open]);

  useEffect(() => {
    if (!selectedTplId) {
      setSelectedTpl(null);
      setQuestions([]);
      return;
    }
    const loadDetail = async () => {
      try {
        const detail = await fetchJson<AgentTemplate & { questions: AgentTemplateQuestion[] }>(
          `${API}/agent-templates/${selectedTplId}`,
        );
        setSelectedTpl(detail);
        setQuestions(detail.questions || []);
        // reset answers
        const initial: Record<string, unknown> = {};
        (detail.questions || []).forEach((q) => {
          initial[q.key] = q.type === "boolean" ? false : "";
        });
        setAnswers(initial);
        setPreview(null);
      } catch (err) {
        setTplError(err instanceof Error ? err.message : "Falha ao carregar template");
      }
    };
    loadDetail();
  }, [selectedTplId]);

  const doPreview = useCallback(async () => {
    if (!selectedTplId) return;
    try {
      const resp = await fetchJson<AgentTemplatePreview>(
        `${API}/agent-templates/${selectedTplId}/preview`,
        { method: "POST", body: JSON.stringify({ answers }) },
      );
      setPreview(resp);
      if (resp.model && !modelOverride) setModelOverride(resp.model);
    } catch (err) {
      setTplError(err instanceof Error ? err.message : "Falha ao gerar prévia");
    }
  }, [answers, modelOverride, selectedTplId]);

  const renderQuestion = (q: AgentTemplateQuestion) => {
    const key = q.key;
    const value = answers[key];
    const set = (val: unknown) => setAnswers((prev) => ({ ...prev, [key]: val }));
    const base = "config-input w-full rounded-xl px-3 py-2 disabled:opacity-70";
    switch (q.type) {
      case "text":
        return (
          <input
            className={base}
            value={String(value ?? "")}
            onChange={(e) => set(e.target.value)}
            placeholder={q.help || q.label}
          />
        );
      case "textarea":
        return (
          <textarea
            className={base}
            value={String(value ?? "")}
            onChange={(e) => set(e.target.value)}
            placeholder={q.help || q.label}
          />
        );
      case "select": {
        const options = Array.isArray(q.options) ? (q.options as string[]) : [];
        return (
          <select className={base} value={String(value ?? "")} onChange={(e) => set(e.target.value)}>
            <option value="">Selecione</option>
            {options.map((op) => (
              <option key={op} value={op}>{op}</option>
            ))}
          </select>
        );
      }
      case "number":
        return (
          <input
            type="number"
            className={base}
            value={String(value ?? "")}
            onChange={(e) => set(e.target.value === "" ? "" : Number(e.target.value))}
            placeholder={q.help || q.label}
          />
        );
      case "boolean":
        return (
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => set(e.target.checked)}
            />
            {q.label}
          </label>
        );
      case "multiselect": {
        const options = Array.isArray(q.options) ? (q.options as string[]) : [];
        const arr = Array.isArray(value) ? (value as string[]) : [];
        const toggle = (op: string) => {
          const next = arr.includes(op) ? arr.filter((v) => v !== op) : [...arr, op];
          set(next);
        };
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((op) => (
              <button
                type="button"
                key={op}
                className={`px-3 py-1.5 rounded-lg text-xs transition ${
                  arr.includes(op) ? "bg-[#1D4ED8] text-white" : "bg-white/5 text-[#94A3B8]"
                }`}
                onClick={() => toggle(op)}
              >
                {op}
              </button>
            ))}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const createAgent = useCallback(async () => {
    if (!name.trim()) { setTplError("Informe o nome do agente"); return; }
    if (!selectedTpl) { setTplError("Selecione um template"); return; }
    setSubmitting(true);
    setTplError(null);
    try {
      if (!preview) await doPreview();
      const payload: AutomationAgentPayload = {
        name: name.trim(),
        description: (preview?.prompt || "").trim(),
        integration_openai_id: integrationId || null,
        model: (modelOverride || preview?.model || "").trim() || undefined,
        model_params: preview?.model_params || {},
        aggregation_enabled: true,
        aggregation_window_sec: 20,
        max_batch_messages: 20,
        allow_handoff: true,
        tools_policy: {},
        media_config: {},
      };
      const created = await fetchJson<AutomationAgent>(`${API}/agents`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      onCreated(created);
    } catch (err) {
      setTplError(err instanceof Error ? err.message : "Falha ao criar agente");
    } finally {
      setSubmitting(false);
    }
  }, [API, doPreview, integrationId, modelOverride, name, onCreated, preview, selectedTpl]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-4xl rounded-xl border border-white/10 bg-[#0F172A] text-[#94A3B8] shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b border-white/5 p-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Novo agente (assistido)</h2>
            <p className="text-sm">Selecione um template, responda às perguntas e gere o prompt automaticamente.</p>
          </div>
          <button type="button" className="text-[#94A3B8] hover:text-white" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
          {tplError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {tplError}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL}>Nome do agente *</label>
              <input className={INPUT_BASE} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Vendedor WhatsApp" />
            </div>
            <div>
              <label className={LABEL}>Integração OpenAI</label>
              <select className={INPUT_BASE} value={integrationId} onChange={(e) => setIntegrationId(e.target.value)}>
                <option value="">Sem integração</option>
                {integrations.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL}>Template</label>
              <select
                className={INPUT_BASE}
                value={selectedTplId}
                onChange={(e) => setSelectedTplId(e.target.value)}
                disabled={tplLoading}
              >
                <option value="">Selecione um template</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.category ? `${t.category} — ${t.name}` : t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL}>Modelo (sugerido pelo template)</label>
              <input
                className={INPUT_BASE}
                value={modelOverride}
                onChange={(e) => setModelOverride(e.target.value)}
                placeholder={preview?.model || selectedTpl?.default_model || "Ex.: gpt-4o-mini"}
              />
            </div>
          </div>

          {selectedTpl && questions.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-[#0B1324] p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Perguntas</h4>
              <div className="grid gap-4 md:grid-cols-2">
                {questions.map((q) => (
                  <div key={q.id}>
                    {q.type !== "boolean" && <label className={LABEL}>{q.label}</label>}
                    {renderQuestion(q)}
                    {q.help && q.type !== "boolean" && (
                      <p className="mt-1 text-xs text-[#64748B]">{q.help}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button type="button" className={SOFT_BTN} onClick={doPreview}>Pré-visualizar</button>
              </div>
            </div>
          )}

          {preview && (
            <div className="rounded-xl border border-white/10 bg-[#0B1324] p-4">
              <h4 className="text-sm font-semibold text-white mb-3">Pré-visualização do prompt</h4>
              <pre className="whitespace-pre-wrap text-sm text-[#CBD5E1]">{preview.prompt}</pre>
              <div className="mt-3 text-xs text-[#94A3B8]">
                <div>Modelo sugerido: <span className="text-white/80">{preview.model || "(nenhum)"}</span></div>
                <div>Params: <span className="text-white/80">{JSON.stringify(preview.model_params)}</span></div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-white/5 p-6">
          <button type="button" className={SOFT_BTN} onClick={onClose} disabled={submitting}>Cancelar</button>
          <button type="button" className={PRIMARY_BTN} onClick={createAgent} disabled={submitting}>
            {submitting ? "Criando..." : "Criar agente"}
          </button>
        </div>
      </div>
    </div>
  );
}

