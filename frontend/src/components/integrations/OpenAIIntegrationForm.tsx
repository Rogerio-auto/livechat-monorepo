import { useEffect, useMemo, useState } from "react";
import type {
  OpenAIIntegration,
  OpenAIIntegrationCreatePayload,
  OpenAIIntegrationUpdatePayload,
  OpenAIIntegrationUsageLimits,
} from "@livechat/shared";
import { Modal } from "../../components/ui/Modal";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";

const selectBaseClasses = "w-full rounded-lg px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50";

const Field = ({ label, children, description }: { label: string; children: React.ReactNode; description?: string }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-b border-gray-100 dark:border-gray-800 last:border-0">
    <div className="md:col-span-1">
      <label className="block text-sm font-semibold text-gray-900 dark:text-white">
        {label}
      </label>
      {description && (
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          {description}
        </p>
      )}
    </div>
    <div className="md:col-span-2">
      {children}
    </div>
  </div>
);

export const OPENAI_MODEL_OPTIONS = [
  "gpt-4o",
  "gpt-4o-mini",
  "o3-mini",
  "o1-mini",
  "gpt-4-turbo",
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

  const title = mode === "create" ? "Nova Integração OpenAI" : "Editar Integração OpenAI";

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
    <Modal
      isOpen={open}
      onClose={onClose}
      title={title}
      size="lg"
    >
      <div className="space-y-0">
        {(validationError || error) && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
            {validationError || error}
          </div>
        )}

        <Field 
          label="Nome da Integração" 
          description="Um nome para identificar esta conta internamente."
        >
          <Input
            value={form.name}
            onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: OpenAI Produção"
            disabled={submitting}
          />
        </Field>

        <Field 
          label="API Key" 
          description={form.auto_generate ? "A chave será gerada automaticamente pelo sistema." : "Sua chave secreta da OpenAI."}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="auto_generate"
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                checked={form.auto_generate}
                onChange={(e) => setForm(prev => ({ ...prev, auto_generate: e.target.checked }))}
                disabled={submitting}
              />
              <label htmlFor="auto_generate" className="text-sm text-gray-700 dark:text-gray-300">
                Gerar automaticamente
              </label>
            </div>
            {!form.auto_generate && (
              <Input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm(prev => ({ ...prev, api_key: e.target.value }))}
                placeholder="sk-..."
                disabled={submitting}
              />
            )}
          </div>
        </Field>

        <Field 
          label="Modelo Padrão" 
          description="O modelo que será usado por padrão se nenhum outro for especificado."
        >
          <div className="space-y-3">
            <select
              className={selectBaseClasses}
              value={defaultModelSelectValue}
              onChange={(e) => handleDefaultModelChange(e.target.value)}
              disabled={submitting}
            >
              <option value="">Selecione um modelo</option>
              {OPENAI_MODEL_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
              <option value="__custom">Outro (especificar)</option>
            </select>
            {form.default_model_mode === "custom" && (
              <Input
                value={form.default_model_custom}
                onChange={(e) => setForm(prev => ({ ...prev, default_model_custom: e.target.value }))}
                placeholder="Nome do modelo (ex: gpt-4-32k)"
                disabled={submitting}
              />
            )}
          </div>
        </Field>

        <Field 
          label="Modelos Permitidos" 
          description="Selecione quais modelos esta conta pode utilizar."
        >
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {OPENAI_MODEL_OPTIONS.map((option) => {
                const active = form.models_allowed.includes(option);
                return (
                  <button
                    type="button"
                    key={option}
                    onClick={() => toggleAllowedModel(option)}
                    disabled={submitting}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      active 
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800' 
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 dark:bg-gray-900 dark:text-gray-400 dark:border-gray-800'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Input
                value={form.custom_model_entry}
                onChange={(e) => setForm(prev => ({ ...prev, custom_model_entry: e.target.value }))}
                placeholder="Adicionar outro modelo..."
                disabled={submitting}
                className="flex-1"
              />
              <Button
                variant="ghost"
                onClick={addCustomAllowedModel}
                disabled={submitting || !hasCustomEntry}
              >
                Adicionar
              </Button>
            </div>
          </div>
        </Field>

        <Field 
          label="Limites de Uso" 
          description="Defina limites para controlar custos e performance."
        >
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="RPM (Requisições por minuto)"
              value={form.usage_limits.rpm}
              onChange={(e) => setForm(prev => ({ ...prev, usage_limits: { ...prev.usage_limits, rpm: e.target.value } }))}
              placeholder="Ex: 3500"
              disabled={submitting}
            />
            <Input
              label="Limite Diário (USD)"
              value={form.usage_limits.daily_usd_cap}
              onChange={(e) => setForm(prev => ({ ...prev, usage_limits: { ...prev.usage_limits, daily_usd_cap: e.target.value } }))}
              placeholder="Ex: 10.00"
              disabled={submitting}
            />
          </div>
        </Field>

        <Field 
          label="Status" 
          description="Ative ou desative esta integração."
        >
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_active"
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
              checked={form.is_active}
              onChange={(e) => setForm(prev => ({ ...prev, is_active: e.target.checked }))}
              disabled={submitting}
            />
            <label htmlFor="is_active" className="text-sm text-gray-700 dark:text-gray-300">
              Integração Ativa
            </label>
          </div>
        </Field>

        <div className="flex justify-end gap-3 pt-8">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "Salvando..." : "Salvar Integração"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

