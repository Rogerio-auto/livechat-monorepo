import { useEffect, useMemo, useState } from "react";
import type {
  OpenAIIntegration,
  OpenAIIntegrationCreatePayload,
  OpenAIIntegrationUpdatePayload,
  OpenAIIntegrationUsageLimits,
} from "../../types/types";

const INPUT_BASE =
  "config-input w-full rounded-xl px-3 py-2 disabled:opacity-70";
const LABEL = "block text-sm config-text-muted mb-1";
const SOFT_BTN = "config-btn px-3 py-2 rounded-lg disabled:opacity-60";
const PRIMARY_BTN =
  "config-btn-primary px-3 py-2 rounded-lg disabled:opacity-60";

export const OPENAI_MODEL_OPTIONS = [
  "gpt-4.1",
  "gpt-4.1-mini",
  "gpt-4o",
  "gpt-4o-mini",
  "o3-mini",
  "o1-mini",
  "gpt-3.5-turbo",
  "text-embedding-3-large",
  "text-embedding-3-small",
] as const;

type Mode = "create" | "edit";

export type OpenAIIntegrationFormSubmit =
  | { mode: "create"; payload: OpenAIIntegrationCreatePayload }
  | { mode: "edit"; integrationId: string; payload: OpenAIIntegrationUpdatePayload };

type Props = {
  open: boolean;
  mode: Mode;
  integration?: OpenAIIntegration;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (data: OpenAIIntegrationFormSubmit) => Promise<void>;
};

type DefaultModelMode = "option" | "custom" | "";

type FormState = {
  name: string;
  api_key: string;
  auto_generate: boolean;
  org_id: string;
  project_id: string;
  default_model_mode: DefaultModelMode;
  default_model_value: string;
  default_model_custom: string;
  models_allowed: string[];
  custom_model_entry: string;
  usage_limits: { rpm: string; daily_usd_cap: string };
  is_active: boolean;
};

const INITIAL_FORM: FormState = {
  name: "",
  api_key: "",
  auto_generate: true,
  org_id: "",
  project_id: "",
  default_model_mode: "",
  default_model_value: "",
  default_model_custom: "",
  models_allowed: [],
  custom_model_entry: "",
  usage_limits: { rpm: "", daily_usd_cap: "" },
  is_active: true,
};

function normalizeOptionalString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseNumberField(value: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function arraysEqual(a: string[] | null | undefined, b: string[] | null | undefined): boolean {
  const arrA = Array.isArray(a) ? a : [];
  const arrB = Array.isArray(b) ? b : [];
  if (arrA.length !== arrB.length) return false;
  const setB = new Set(arrB);
  return arrA.every((item) => setB.has(item));
}

export default function OpenAIIntegrationForm({
  open,
  mode,
  integration,
  submitting = false,
  error,
  onClose,
  onSubmit,
}: Props) {
  const initialLimits = useMemo<OpenAIIntegrationUsageLimits>(() => {
    if (mode === "edit" && integration?.usage_limits) {
      return integration.usage_limits;
    }
    return {};
  }, [integration, mode]);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && integration) {
      const defaultModel = integration.default_model ?? "";
      const defaultModelIsOption = defaultModel
        ? OPENAI_MODEL_OPTIONS.includes(defaultModel as (typeof OPENAI_MODEL_OPTIONS)[number])
        : false;
      const allowedModels = Array.isArray(integration.models_allowed)
        ? Array.from(
            new Set(
              integration.models_allowed
                .filter((model): model is string => typeof model === "string" && model.trim().length > 0)
                .map((model) => model.trim()),
            ),
          )
        : [];

      setForm({
        name: integration.name ?? "",
        api_key: "",
        auto_generate: Boolean(integration.auto_generated),
        org_id: integration.org_id ?? "",
        project_id: integration.project_id ?? "",
        default_model_mode: defaultModel ? (defaultModelIsOption ? "option" : "custom") : "",
        default_model_value: defaultModelIsOption ? defaultModel : "",
        default_model_custom: defaultModelIsOption ? "" : defaultModel,
        models_allowed: allowedModels,
        custom_model_entry: "",
        usage_limits: {
          rpm:
            typeof integration.usage_limits?.rpm === "number"
              ? String(integration.usage_limits.rpm)
              : "",
          daily_usd_cap:
            typeof integration.usage_limits?.daily_usd_cap === "number"
              ? String(integration.usage_limits.daily_usd_cap)
              : "",
        },
        is_active: Boolean(integration.is_active),
      });
    } else {
      setForm(INITIAL_FORM);
    }
    setValidationError(null);
  }, [open, mode, integration]);

  if (!open) return null;

  const defaultModelSelectValue =
    form.default_model_mode === "option"
      ? form.default_model_value
      : form.default_model_mode === "custom"
        ? "__custom"
        : "";

  const handleDefaultModelChange = (value: string) => {
    if (value === "__custom") {
      setForm((prev) => ({
        ...prev,
        default_model_mode: "custom",
        default_model_value: "",
      }));
      return;
    }
    if (!value) {
      setForm((prev) => ({
        ...prev,
        default_model_mode: "",
        default_model_value: "",
        default_model_custom: "",
      }));
      return;
    }
    setForm((prev) => ({
      ...prev,
      default_model_mode: "option",
      default_model_value: value,
      default_model_custom: "",
    }));
  };

  const toggleAllowedModel = (model: string) => {
    setForm((prev) => {
      const exists = prev.models_allowed.includes(model);
      return {
        ...prev,
        models_allowed: exists
          ? prev.models_allowed.filter((item) => item !== model)
          : [...prev.models_allowed, model],
      };
    });
  };

  const removeAllowedModel = (model: string) => {
    setForm((prev) => ({
      ...prev,
      models_allowed: prev.models_allowed.filter((item) => item !== model),
    }));
  };

  const addCustomAllowedModel = () => {
    const trimmed = form.custom_model_entry.trim();
    if (!trimmed) return;
    setForm((prev) => {
      if (prev.models_allowed.includes(trimmed)) {
        return { ...prev, custom_model_entry: "" };
      }
      return {
        ...prev,
        models_allowed: [...prev.models_allowed, trimmed],
        custom_model_entry: "",
      };
    });
  };

  const hasCustomEntry = form.custom_model_entry.trim().length > 0;

  const title = mode === "create" ? "Nova integração OpenAI" : "Editar integração OpenAI";

  async function handleSubmit() {
    setValidationError(null);
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setValidationError("Informe o nome da integração.");
      return;
    }
    const trimmedApiKey = form.api_key.trim();
    if (!form.auto_generate) {
      if (mode === "create" && trimmedApiKey.length < 10) {
        setValidationError("Informe a API Key (mínimo 10 caracteres).");
        return;
      }
      if (mode === "edit" && trimmedApiKey && trimmedApiKey.length < 10) {
        setValidationError("A nova API Key deve ter ao menos 10 caracteres.");
        return;
      }
    }

    const resolvedDefaultModel =
      form.default_model_mode === "custom"
        ? form.default_model_custom.trim()
        : form.default_model_mode === "option"
          ? form.default_model_value
          : "";

    if (form.default_model_mode === "custom" && resolvedDefaultModel.length < 2) {
      setValidationError("Informe o modelo personalizado.");
      return;
    }

    const sanitizedModels = Array.from(
      new Set(
        form.models_allowed
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
      ),
    );
    if (resolvedDefaultModel && !sanitizedModels.includes(resolvedDefaultModel)) {
      sanitizedModels.push(resolvedDefaultModel);
    }

    const rpmValue = parseNumberField(form.usage_limits.rpm);
    const dailyCapValue = parseNumberField(form.usage_limits.daily_usd_cap);

    if (mode === "create") {
      const payload: OpenAIIntegrationCreatePayload = {
        name: trimmedName,
        auto_generate: form.auto_generate,
      };
      if (!form.auto_generate) {
        payload.api_key = trimmedApiKey;
      }
      const orgId = normalizeOptionalString(form.org_id);
      const projectId = normalizeOptionalString(form.project_id);
      if (orgId !== null) payload.org_id = orgId;
      if (projectId !== null) payload.project_id = projectId;
      if (resolvedDefaultModel) payload.default_model = resolvedDefaultModel;
      if (sanitizedModels.length > 0) payload.models_allowed = sanitizedModels;
      const usageLimits: OpenAIIntegrationUsageLimits = {};
      if (rpmValue !== undefined) usageLimits.rpm = rpmValue;
      if (dailyCapValue !== undefined) usageLimits.daily_usd_cap = dailyCapValue;
      if (Object.keys(usageLimits).length > 0) payload.usage_limits = usageLimits;
      if (!form.is_active) payload.is_active = false;

      await onSubmit({ mode: "create", payload });
      return;
    }

    if (!integration) return;

    const patch: OpenAIIntegrationUpdatePayload = {};
    if (trimmedName !== integration.name) {
      patch.name = trimmedName;
    }
    if (trimmedApiKey) {
      patch.api_key = trimmedApiKey;
    }

    const nextOrgId = normalizeOptionalString(form.org_id);
    const currentOrgId = integration.org_id ?? null;
    if ((nextOrgId ?? null) !== (currentOrgId ?? null)) {
      patch.org_id = nextOrgId === null ? null : nextOrgId;
    }

    const nextProjectId = normalizeOptionalString(form.project_id);
    const currentProjectId = integration.project_id ?? null;
    if ((nextProjectId ?? null) !== (currentProjectId ?? null)) {
      patch.project_id = nextProjectId === null ? null : nextProjectId;
    }

    const currentDefaultModel = integration.default_model ?? null;
    if ((resolvedDefaultModel || null) !== (currentDefaultModel ?? null)) {
      patch.default_model = resolvedDefaultModel || null;
    }

    if (!arraysEqual(sanitizedModels, integration.models_allowed ?? null)) {
      patch.models_allowed = sanitizedModels.length > 0 ? sanitizedModels : [];
    }

    const initialRpm =
      typeof initialLimits?.rpm === "number" ? initialLimits.rpm : undefined;
    const initialDaily =
      typeof initialLimits?.daily_usd_cap === "number"
        ? initialLimits.daily_usd_cap
        : undefined;

    const baseLimits = (() => {
      if (!initialLimits || typeof initialLimits !== "object") return {};
      const { rpm, daily_usd_cap, ...rest } = initialLimits;
      return { ...rest };
    })();

    const nextLimits: OpenAIIntegrationUsageLimits = { ...baseLimits };
    if (rpmValue !== undefined) {
      nextLimits.rpm = rpmValue;
    }
    if (dailyCapValue !== undefined) {
      nextLimits.daily_usd_cap = dailyCapValue;
    }

    const rpmChanged = (rpmValue ?? null) !== (initialRpm ?? null);
    const dailyChanged = (dailyCapValue ?? null) !== (initialDaily ?? null);

    if (rpmChanged || dailyChanged) {
      patch.usage_limits = Object.keys(nextLimits).length > 0 ? nextLimits : {};
    }

    if (Boolean(form.is_active) !== Boolean(integration.is_active)) {
      patch.is_active = form.is_active;
    }

    if (Object.keys(patch).length === 0) {
      setValidationError("Nenhuma alteração detectada.");
      return;
    }

    await onSubmit({ mode: "edit", integrationId: integration.id, payload: patch });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)] px-4">
      <div className="config-modal w-full max-w-2xl rounded-2xl shadow-lg">
        <div className="flex items-start justify-between gap-4 border-b config-divider p-6">
          <div>
            <h2 className="text-xl font-semibold config-heading">{title}</h2>
            <p className="text-sm config-text-muted">
              Configuração segura — a chave fica salva somente no servidor.
            </p>
          </div>
          <button
            type="button"
            className="config-text-muted transition hover:text-[var(--color-heading)]"
            onClick={onClose}
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
            <div className="md:col-span-2">
              <label className={LABEL}>Nome da Integração *</label>
              <input
                className={INPUT_BASE}
                value={form.name}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, name: event.target.value }))
                }
                disabled={submitting}
                placeholder="Ex: OpenAI Empresa"
              />
              <p className="mt-2 text-xs text-blue-400 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Uma nova chave de API será gerada automaticamente para esta empresa.
              </p>
            </div>
            
            <div>
              <label className={LABEL}>Modelo padrão</label>
              <select
                className={INPUT_BASE}
                value={defaultModelSelectValue}
                onChange={(event) => handleDefaultModelChange(event.target.value)}
                disabled={submitting}
              >
                <option value="">Selecione</option>
                {OPENAI_MODEL_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
                <option value="__custom">Outro (digitar)</option>
              </select>
              {form.default_model_mode === "custom" && (
                <input
                  className={`${INPUT_BASE} mt-3`}
                  value={form.default_model_custom}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, default_model_custom: event.target.value }))
                  }
                  disabled={submitting}
                  placeholder="Digite o nome do modelo"
                />
              )}
            </div>
            <div>
              <label className={LABEL}>Modelos permitidos</label>
              <div className="flex flex-wrap gap-2">
                {OPENAI_MODEL_OPTIONS.map((option) => {
                  const active = form.models_allowed.includes(option);
                  return (
                    <button
                      type="button"
                      key={option}
                      className={`${active ? "config-btn-primary" : "config-btn"} px-3 py-1 rounded-lg text-xs transition`}
                      onClick={() => toggleAllowedModel(option)}
                      disabled={submitting}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
              {form.models_allowed.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {form.models_allowed.map((model) => (
                    <span
                      key={model}
                      className="config-chip inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                    >
                      {model}
                      <button
                        type="button"
                        className="config-text-muted hover:text-[var(--color-heading)]"
                        onClick={() => removeAllowedModel(model)}
                        disabled={submitting}
                        aria-label={`Remover modelo ${model}`}
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <input
                  className={INPUT_BASE}
                  value={form.custom_model_entry}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, custom_model_entry: event.target.value }))
                  }
                  disabled={submitting}
                  placeholder="Adicionar modelo manualmente"
                />
                <button
                  type="button"
                  className={SOFT_BTN}
                  onClick={addCustomAllowedModel}
                  disabled={submitting || !hasCustomEntry}
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={LABEL}>Limite RPM</label>
              <input
                className={INPUT_BASE}
                value={form.usage_limits.rpm}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    usage_limits: { ...prev.usage_limits, rpm: event.target.value },
                  }))
                }
                disabled={submitting}
                placeholder="Ex: 3000"
              />
            </div>
            <div>
              <label className={LABEL}>Gasto diário (USD)</label>
              <input
                className={INPUT_BASE}
                value={form.usage_limits.daily_usd_cap}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    usage_limits: {
                      ...prev.usage_limits,
                      daily_usd_cap: event.target.value,
                    },
                  }))
                }
                disabled={submitting}
                placeholder="Ex: 25"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm config-text-muted">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, is_active: event.target.checked }))
              }
              disabled={submitting}
            />
            Integração ativa
          </label>
        </div>
        <div className="flex justify-end gap-3 border-t config-divider p-6">
          <button type="button" className={SOFT_BTN} onClick={onClose} disabled={submitting}>
            Cancelar
          </button>
          <button
            type="button"
            className={PRIMARY_BTN}
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
