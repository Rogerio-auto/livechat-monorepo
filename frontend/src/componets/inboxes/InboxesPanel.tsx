import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Inbox,
  InboxForm,
  MetaProviderConfig,
  ProviderConfig,
} from "../../types/types";
import MetaConfig from "../settings/inboxes/MetaConfig";
import WahaConfig from "../settings/inboxes/WahaConfig";
import { Card, Input, Button } from "../../components/ui";

// Estilos utilitários (para elementos que ainda não possuem componente no design system, como <select>)
const selectBaseClasses =
  "w-full rounded-xl px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-60 transition-colors duration-200";

type InboxFormExtended = InboxForm &
  Pick<Inbox, "base_url" | "api_version" | "instance_id" | "phone_number_id"> & {
  provider_config?: ProviderConfig;
};

type WahaSessionInfo = {
  status?: string | null;
  phone?: string | null;
  number?: string | null;
  connectedPhone?: string | null;
};

// ====== UI helpers ======
const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block space-y-2">
    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</div>
    {children}
  </label>
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
  provider: string | undefined,
  config?: ProviderConfig,
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
  onRequestCreate: () => void;
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
  onRequestCreate,
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
        <span className="px-3 py-1 rounded-lg text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
          Total: {totalInboxes}
        </span>
        <Button onClick={onRequestCreate} disabled={disabled} variant="primary" size="sm">
          + Nova caixa
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <Card key={inbox.id} padding="md">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {form.name || inbox.name || `Inbox ${inbox.id.slice(0, 6)}`}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {form.phone_number || inbox.phone_number}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2.5 py-1 rounded-md text-xs border ${form.is_active
                      ? "bg-blue-50 text-blue-700 dark:bg-blue-600/20 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700"
                      }`}
                  >
                    {form.is_active ? "Ativa" : "Inativa"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedId(expanded ? null : inbox.id)}
                  >
                    {expanded ? "Fechar" : "Configurar"}
                  </Button>
                </div>
              </div>

              {expanded && (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Nome"
                      placeholder="Identificação da caixa"
                      value={form.name}
                      onChange={(e) => handleChange(inbox.id, "name", e.target.value)}
                      autoComplete="off"
                      disabled={disabled}
                    />
                    {!isWaha && (
                      <Input
                        label="Telefone"
                        placeholder="Número com DDD"
                        value={form.phone_number}
                        onChange={(e) => handleChange(inbox.id, "phone_number", e.target.value)}
                        autoComplete="off"
                        inputMode="tel"
                        disabled={disabled}
                      />
                    )}
                  </div>

                  {!isWaha && (
                    <Input
                      label="Webhook URL"
                      placeholder="https://..."
                      value={webhookValue}
                      onChange={(e) => handleChange(inbox.id, "webhook_url", e.target.value)}
                      autoComplete="off"
                      readOnly={isMeta}
                      helperText={isMeta ? "Definido automaticamente para Meta Cloud" : undefined}
                      disabled={disabled}
                    />
                  )}

                  {!isWaha ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Provider">
                        <select
                          className={selectBaseClasses}
                          value={form.provider}
                          onChange={(e) => handleChange(inbox.id, "provider", e.target.value)}
                          disabled={disabled}
                        >
                          <option value="META_CLOUD">Meta Cloud</option>
                          <option value="WAHA">WAHA</option>
                          <option value="OTHER">Outro</option>
                        </select>
                      </Field>

                      <Field label="Canal">
                        <select
                          className={selectBaseClasses}
                          value={form.channel}
                          onChange={(e) => handleChange(inbox.id, "channel", e.target.value)}
                          disabled={disabled}
                        >
                          <option value="WHATSAPP">WhatsApp</option>
                          <option value="OTHER">Outro</option>
                        </select>
                      </Field>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-sm text-gray-700 dark:text-gray-300 bg-white/60 dark:bg-gray-800/60">
                      Conexão WAHA (não oficial)
                    </div>
                  )}

                  {isMeta && (
                    <MetaConfig
                      value={meta}
                      onChange={(next) => handleMetaChange(inbox.id, next)}
                      disabled={disabled}
                    />
                  )}
                  {isWaha && (
                    <WahaConfig
                      key={instanceIdValue || inbox.id}
                      sessionId={instanceIdValue}
                      onStatusChange={(info) => handleWahaStatusChange(inbox.id, info)}
                      disabled={disabled}
                    />
                  )}
                  <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={!!form.is_active}
                      onChange={(e) => handleChange(inbox.id, "is_active", e.target.checked)}
                      disabled={disabled}
                    />
                    Ativa
                  </label>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => handleSave(inbox.id)}
                      disabled={disabled || !isDirty(inbox.id)}
                      variant="primary"
                      size="sm"
                    >
                      Salvar
                    </Button>
                    <Button
                      onClick={() => handleCancel(inbox.id)}
                      disabled={disabled || !isDirty(inbox.id)}
                      variant="ghost"
                      size="sm"
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={() => onRequestDelete(inbox.id)}
                      disabled={disabled}
                      variant="danger"
                      size="sm"
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              )}
            </Card>
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







