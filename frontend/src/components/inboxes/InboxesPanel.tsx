import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Inbox,
  InboxForm,
  InboxFormExtended,
  MetaProviderConfig,
  ProviderConfig,
  WahaSessionInfo,
} from "@livechat/shared";
import MetaConfig from "../settings/inboxes/MetaConfig";
import WahaConfig from "../settings/inboxes/WahaConfig";
import MetaFlowsManager from "../settings/inboxes/MetaFlowsManager";
import { Card, Input, Button } from "../../components/ui";

// Estilos utilitários (para elementos que ainda não possuem componente no design system, como <select>)
const selectBaseClasses =
  "w-full rounded-md px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 transition-all duration-200 text-sm shadow-xs";

// ====== UI helpers ======
const Field = ({ label, children, description }: { label: string; children: ReactNode; description?: string }) => (
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 border-b border-gray-50 dark:border-gray-800 last:border-0">
    <div className="md:col-span-1">
      <div className="text-sm font-medium text-gray-900 dark:text-white">{label}</div>
      {description && <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{description}</div>}
    </div>
    <div className="md:col-span-2">
      {children}
    </div>
  </div>
);

const DEFAULT_META: MetaProviderConfig = {
  access_token: "",
  refresh_token: "",
  provider_api_key: "",
  phone_number_id: "",
  waba_id: "",
  webhook_verify_token: "",
  app_secret: "",
};

const WAHA_CONNECTED_STATUSES = new Set(["WORKING", "CONNECTED", "READY", "OPEN", "RUNNING"]);
const WAHA_DISCONNECTED_STATUSES = new Set(["FAILED", "STOPPED", "CLOSED", "LOGGED_OUT", "DISCONNECTED", "QR_TIMEOUT"]);

function normalizeProviderConfig(
  provider: string | null | undefined,
  config?: ProviderConfig | null,
): ProviderConfig | undefined {
  const upper = (provider || "").toUpperCase();
  const next: ProviderConfig = { ...(config || {}) };
  if (next.meta || upper === "META_CLOUD") {
    next.meta = {
      ...DEFAULT_META,
      ...(next.meta || {}),
    };
  }
  if (upper !== "WAHA" && next.waha) {
    delete next.waha;
  }
  if (!next.meta && !next.waha) {
    return Object.keys(next).length ? next : undefined;
  }
  return next;
}

type InboxesPanelProps = {
  companyInboxes: Inbox[];
  forms: Record<string, InboxFormExtended>;     // <- usa o extendido
  baseline: Record<string, InboxFormExtended>;  // <- usa o extendido
  setCompanyInboxes: (updater: (prev: Inbox[]) => Inbox[]) => void;
  setForms: (updater: (prev: Record<string, InboxFormExtended>) => Record<string, InboxFormExtended>) => void;
  setBaseline: (updater: (prev: Record<string, InboxFormExtended>) => Record<string, InboxFormExtended>) => void;
  onSave: (id: string, data: InboxFormExtended) => Promise<void>;
  onRequestDelete: (id: string) => void;
  metaWebhookUrl: string;
  disabled?: boolean;
  initialExpandedId?: string | null;
  onExpandedChange?: (id: string | null) => void;
};

export default function InboxesPanel({
  companyInboxes,
  forms,
  baseline,
  setCompanyInboxes,
  setForms,
  setBaseline,
  onSave,
  onRequestDelete,
  metaWebhookUrl,
  disabled,
  initialExpandedId,
  onExpandedChange,
}: InboxesPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const appliedInitialRef = useRef<string | null>(null);
  const totalInboxes = useMemo(() => companyInboxes.length, [companyInboxes]);

  useEffect(() => {
    if (initialExpandedId && initialExpandedId !== appliedInitialRef.current) {
      setExpandedId(initialExpandedId);
      appliedInitialRef.current = initialExpandedId;
    }
    if (initialExpandedId === null && appliedInitialRef.current !== null) {
      appliedInitialRef.current = null;
    }
  }, [initialExpandedId]);

  useEffect(() => {
    onExpandedChange?.(expandedId);
  }, [expandedId, onExpandedChange]);

  const ensureSeed = (id: string): InboxFormExtended => {
    const source = forms[id] || baseline[id];
    if (source) {
      const provider = source.provider || "META_CLOUD";
      const seeded: InboxFormExtended = {
        ...source,
        provider,
        provider_config: normalizeProviderConfig(provider, source.provider_config),
      };
      if ((provider || "META_CLOUD") === "META_CLOUD") {
        seeded.webhook_url = metaWebhookUrl;
      } else {
        seeded.webhook_url = seeded.webhook_url || "";
      }
      if (!seeded.instance_id) {
        const base = baseline[id];
        seeded.instance_id = base?.instance_id || base?.phone_number_id || "";
      }
      if (!seeded.phone_number_id) {
        const base = baseline[id];
        seeded.phone_number_id = base?.phone_number_id || seeded.instance_id || "";
      }
      return seeded;
    }
    return {
      name: "",
      phone_number: "",
      webhook_url: metaWebhookUrl,
      is_active: false,
      provider: "META_CLOUD",
      channel: "WHATSAPP",
      provider_config: normalizeProviderConfig("META_CLOUD", { meta: { ...DEFAULT_META } }),
      base_url: "",
      api_version: "",
      instance_id: "",
      phone_number_id: "",
    };
  };

  const handleWahaStatusChange = useCallback((id: string, info: WahaSessionInfo | null) => {
    const rawNumber = info?.phone ?? info?.number ?? info?.connectedPhone ?? "";
    const normalizedNumber = typeof rawNumber === "string" ? rawNumber.trim() : "";
    const statusRaw = typeof info?.status === "string" ? info.status.trim() : "";
    const status = statusRaw.toUpperCase();
    const isConnected = status ? WAHA_CONNECTED_STATUSES.has(status) : undefined;
    const isDisconnected = status ? WAHA_DISCONNECTED_STATUSES.has(status) : undefined;

    if (!normalizedNumber && !status) return;

    setForms((prev) => {
      const current = prev[id] ?? baseline[id];
      if (!current) return prev;
      let changed = false;
      const next: InboxFormExtended = { ...current };
      if (normalizedNumber && next.phone_number !== normalizedNumber) {
        next.phone_number = normalizedNumber;
        changed = true;
      }
      if (next.instance_id && next.phone_number_id !== next.instance_id) {
        next.phone_number_id = next.instance_id;
        changed = true;
      }
      if (isConnected !== undefined) {
        if (isConnected && next.is_active !== true) {
          next.is_active = true;
          changed = true;
        } else if (!isConnected && isDisconnected && next.is_active !== false) {
          next.is_active = false;
          changed = true;
        }
      }
      if (!changed) return prev;
      return { ...prev, [id]: next };
    });

    setBaseline((prev) => {
      const current = prev[id];
      if (!current) return prev;
      let changed = false;
      const next: InboxFormExtended = { ...current };
      if (normalizedNumber && next.phone_number !== normalizedNumber) {
        next.phone_number = normalizedNumber;
        changed = true;
      }
      if (next.instance_id && next.phone_number_id !== next.instance_id) {
        next.phone_number_id = next.instance_id;
        changed = true;
      }
      if (isConnected !== undefined) {
        if (isConnected && next.is_active !== true) {
          next.is_active = true;
          changed = true;
        } else if (!isConnected && isDisconnected && next.is_active !== false) {
          next.is_active = false;
          changed = true;
        }
      }
      if (!changed) return prev;
      return { ...prev, [id]: next };
    });

    setCompanyInboxes((prev) => {
      let changed = false;
      const nextList = prev.map((entry) => {
        if (entry.id !== id) return entry;
        const next = { ...entry };
        if (normalizedNumber && next.phone_number !== normalizedNumber) {
          next.phone_number = normalizedNumber;
          changed = true;
        }
        if (next.instance_id && next.phone_number_id !== next.instance_id) {
          next.phone_number_id = next.instance_id;
          changed = true;
        }
        if (isConnected !== undefined) {
          if (isConnected && next.is_active !== true) {
            next.is_active = true;
            changed = true;
          } else if (!isConnected && isDisconnected && next.is_active !== false) {
            next.is_active = false;
            changed = true;
          }
        }
        return next;
      });
      return changed ? nextList : prev;
    });
  }, [baseline, setForms, setBaseline, setCompanyInboxes]);

  const handleChange = (
    id: string,
    field: keyof InboxFormExtended,
    value: string | boolean | ProviderConfig,
  ) => {
    setForms((prev) => {
      const current = ensureSeed(id);
      if (field === "webhook_url" && (current.provider || "META_CLOUD") === "META_CLOUD") {
        return prev;
      }
      const next: InboxFormExtended = {
        ...current,
        [field]: value as any,
      };

      if (field === "provider") {
        const providerValue = ((value as string) || "").toUpperCase();
        next.provider = providerValue;
        next.webhook_url = providerValue === "META_CLOUD" ? metaWebhookUrl : "";
      }

      next.provider_config = normalizeProviderConfig(next.provider, next.provider_config);

      if ((next.provider || "META_CLOUD") === "META_CLOUD") {
        next.webhook_url = metaWebhookUrl;
      }

      return {
        ...prev,
        [id]: next,
      };
    });
  };

  const handleMetaChange = (id: string, nextMeta: MetaProviderConfig) => {
    setForms((prev) => {
      const current = ensureSeed(id);
      return {
        ...prev,
        [id]: {
          ...current,
          provider_config: normalizeProviderConfig(current.provider, {
            ...(current.provider_config || {}),
            meta: {
              ...DEFAULT_META,
              ...(current.provider_config?.meta || {}),
              ...nextMeta,
            },
          }),
        },
      };
    });
  };

  const isDirty = (id: string) => {
    const current = forms[id];
    const base = baseline[id];
    if (!current || !base) return false;
    return JSON.stringify(current) !== JSON.stringify(base);
  };

  const handleSave = async (id: string) => {
    if (disabled) return;
    const payload = forms[id];
    if (!payload) return;
    await onSave(id, payload);
  };

  const handleCancel = (id: string) => {
    const base = baseline[id];
    if (!base) return;
    setForms((prev) => ({ ...prev, [id]: { ...base } }));
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="px-3 py-1 rounded-lg text-sm text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
          Total: {totalInboxes}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {companyInboxes.map((inbox) => {
          const form = ensureSeed(inbox.id);
          const expanded = expandedId === inbox.id;

          const meta = { ...DEFAULT_META, ...(form.provider_config?.meta || {}) };
          const isMeta = form.provider === "META_CLOUD";
          const isWaha = form.provider === "WAHA";
          const webhookValue = isMeta ? metaWebhookUrl : form.webhook_url || "";
          const instanceIdValue =
            form.phone_number_id ||
            form.instance_id ||
            inbox.phone_number_id ||
            inbox.instance_id ||
            "";

          return (
            <div key={inbox.id} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden transition-all duration-200 shadow-sm hover:shadow-md">
              <div className={`p-6 flex items-center justify-between ${expanded ? 'border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/20' : ''}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${form.is_active ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600'}`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                      {form.name || inbox.name || `Inbox ${inbox.id.slice(0, 6)}`}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {form.phone_number || inbox.phone_number || 'Sem número'}
                      </span>
                      <span className="text-gray-300 dark:text-gray-700">•</span>
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {form.provider}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium border ${form.is_active
                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800/50"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                      }`}
                  >
                    {form.is_active ? "Ativa" : "Inativa"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(expanded ? null : inbox.id)}
                    className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  >
                    {expanded ? "Recolher" : "Gerenciar"}
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="p-6 space-y-0">
                  <Field 
                    label="Nome da Caixa" 
                    description="Como esta caixa será identificada internamente."
                  >
                    <Input
                      placeholder="Ex: WhatsApp Comercial"
                      value={form.name}
                      onChange={(e) => handleChange(inbox.id, "name", e.target.value)}
                      autoComplete="off"
                      disabled={disabled}
                    />
                  </Field>

                  {!isWaha && (
                    <Field 
                      label="Número de Telefone" 
                      description="O número de telefone associado a esta caixa."
                    >
                      <Input
                        placeholder="5511999999999"
                        value={form.phone_number}
                        onChange={(e) => handleChange(inbox.id, "phone_number", e.target.value)}
                        autoComplete="off"
                        inputMode="tel"
                        disabled={disabled}
                      />
                    </Field>
                  )}

                  {!isWaha && (
                    <Field 
                      label="Webhook URL" 
                      description="URL para onde as mensagens recebidas serão enviadas."
                    >
                      <Input
                        placeholder="https://..."
                        value={webhookValue}
                        onChange={(e) => handleChange(inbox.id, "webhook_url", e.target.value)}
                        autoComplete="off"
                        readOnly={isMeta}
                        helperText={isMeta ? "Configurado automaticamente para Meta Cloud" : undefined}
                        disabled={disabled}
                      />
                    </Field>
                  )}

                  {!isWaha ? (
                    <>
                      <Field 
                        label="Provedor" 
                        description="A tecnologia utilizada para conectar este canal."
                      >
                        <select
                          className={selectBaseClasses}
                          value={form.provider || ""}
                          onChange={(e) => handleChange(inbox.id, "provider", e.target.value)}
                          disabled={disabled}
                        >
                          <option value="META_CLOUD">Meta Cloud (Oficial)</option>
                          <option value="WAHA">WAHA (Não oficial)</option>
                          <option value="OTHER">Outro</option>
                        </select>
                      </Field>

                      <Field 
                        label="Canal" 
                        description="O tipo de canal de comunicação."
                      >
                        <select
                          className={selectBaseClasses}
                          value={form.channel || ""}
                          onChange={(e) => handleChange(inbox.id, "channel", e.target.value)}
                          disabled={disabled}
                        >
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="OTHER">Outro</option>
                        </select>
                      </Field>
                    </>
                  ) : (
                    <div className="py-6 border-b border-gray-100 dark:border-gray-800">
                      <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 p-4 text-sm text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20">
                        <div className="flex gap-3">
                          <svg className="w-5 h-5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <p className="font-medium">Conexão WAHA</p>
                            <p className="mt-1 opacity-90">Esta é uma conexão não oficial. Certifique-se de que sua instância WAHA está rodando corretamente.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {isMeta && (
                    <>
                      <div className="py-6 border-b border-gray-100 dark:border-gray-800">
                        <MetaConfig
                          value={meta}
                          onChange={(next) => handleMetaChange(inbox.id, next)}
                          disabled={disabled}
                        />
                      </div>
                      <MetaFlowsManager inboxId={inbox.id} />
                    </>
                  )}
                  
                  {isWaha && (
                    <div className="py-6 border-b border-gray-100 dark:border-gray-800">
                      <WahaConfig
                        key={instanceIdValue || inbox.id}
                        sessionId={instanceIdValue}
                        onStatusChange={(info) => handleWahaStatusChange(inbox.id, info)}
                        disabled={disabled}
                      />
                    </div>
                  )}

                  <Field 
                    label="Status da Caixa" 
                    description="Ative ou desative esta caixa de entrada."
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id={`active-${inbox.id}`}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-700"
                        checked={!!form.is_active}
                        onChange={(e) => handleChange(inbox.id, "is_active", e.target.checked)}
                        disabled={disabled}
                      />
                      <label htmlFor={`active-${inbox.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                        Caixa Ativa
                      </label>
                    </div>
                  </Field>

                  <div className="py-6 flex items-center justify-between">
                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleSave(inbox.id)}
                        disabled={disabled || !isDirty(inbox.id)}
                        variant="primary"
                        size="sm"
                      >
                        Salvar Alterações
                      </Button>
                      <Button
                        onClick={() => handleCancel(inbox.id)}
                        disabled={disabled || !isDirty(inbox.id)}
                        variant="ghost"
                        size="sm"
                      >
                        Descartar
                      </Button>
                    </div>
                    <Button
                      onClick={() => onRequestDelete(inbox.id)}
                      disabled={disabled}
                      variant="danger"
                      size="sm"
                    >
                      Excluir Caixa
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {companyInboxes.length === 0 && (
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Nenhuma caixa de entrada cadastrada.
          </div>
        )}
      </div>
    </section>
  );
}







