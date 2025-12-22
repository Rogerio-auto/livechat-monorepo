import { useState, useEffect, useCallback } from "react";
import { API, fetchJson } from "../utils/api";
import type {
  Inbox,
  InboxForm,
  InboxFormExtended,
  MetaProviderConfig,
  ProviderConfig,
  WahaProviderConfig,
} from "../types/types";

const META_WEBHOOK_URL = `${API}/webhooks/meta`;

const DEFAULT_META: MetaProviderConfig = {
  access_token: "",
  refresh_token: "",
  provider_api_key: "",
  phone_number_id: "",
  waba_id: "",
  webhook_verify_token: "",
  app_secret: "",
};

const pickFirstDefined = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (value !== undefined && value !== null) return value;
  }
  return "";
};

const toFormMeta = (
  meta?: MetaProviderConfig | null,
  fallback?: Partial<MetaProviderConfig>,
): MetaProviderConfig => ({
  access_token: String(pickFirstDefined(meta?.access_token, fallback?.access_token)),
  refresh_token: String(pickFirstDefined(meta?.refresh_token, fallback?.refresh_token)),
  provider_api_key: String(pickFirstDefined(meta?.provider_api_key, fallback?.provider_api_key)),
  phone_number_id: String(pickFirstDefined(meta?.phone_number_id, fallback?.phone_number_id)),
  waba_id: String(pickFirstDefined(meta?.waba_id, fallback?.waba_id)),
  webhook_verify_token: String(pickFirstDefined(meta?.webhook_verify_token, fallback?.webhook_verify_token)),
  app_secret: String(pickFirstDefined(meta?.app_secret, fallback?.app_secret)),
});

const toFormWaha = (waha?: WahaProviderConfig | null): WahaProviderConfig => ({
  api_key: waha?.api_key ? String(waha.api_key) : "",
});

const sanitizeToNull = (v: any) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s.length > 0 ? s : null;
};

const buildMetaPayload = (meta?: MetaProviderConfig) => {
  if (!meta) return undefined;
  const res: any = {};
  if (meta.access_token) res.access_token = meta.access_token;
  if (meta.refresh_token) res.refresh_token = meta.refresh_token;
  if (meta.provider_api_key) res.provider_api_key = meta.provider_api_key;
  if (meta.phone_number_id) res.phone_number_id = meta.phone_number_id;
  if (meta.waba_id) res.waba_id = meta.waba_id;
  if (meta.webhook_verify_token) res.webhook_verify_token = meta.webhook_verify_token;
  if (meta.app_secret) res.app_secret = meta.app_secret;
  return Object.keys(res).length ? res : undefined;
};

const buildWahaPayload = (waha?: WahaProviderConfig) => {
  if (!waha) return undefined;
  const res: any = {};
  if (waha.api_key) res.api_key = waha.api_key;
  return Object.keys(res).length ? res : undefined;
};

export const EMPTY_INBOX_FORM: InboxFormExtended = {
  name: "",
  phone_number: "",
  webhook_url: META_WEBHOOK_URL,
  is_active: true,
  provider: "META_CLOUD",
  channel: "WHATSAPP",
  base_url: "",
  api_version: "",
  instance_id: "",
  phone_number_id: "",
  provider_config: { meta: { ...DEFAULT_META } },
};

export const EMPTY_WAHA_FORM: InboxFormExtended = {
  name: "",
  phone_number: "",
  webhook_url: "",
  is_active: false,
  provider: "WAHA",
  channel: "WHATSAPP",
  base_url: "",
  api_version: "",
  instance_id: "",
  phone_number_id: "",
  provider_config: undefined,
};

export function useInboxesSettings() {
  const [companyInboxes, setCompanyInboxes] = useState<Inbox[]>([]);
  const [inboxForms, setInboxForms] = useState<Record<string, InboxFormExtended>>({});
  const [inboxBaseline, setInboxBaseline] = useState<Record<string, InboxFormExtended>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  const normalizeInboxForm = useCallback((
    data: Partial<InboxFormExtended> & { webhook_url?: string | null },
    source?: Partial<Inbox>,
  ) => {
    const provider = (data.provider || source?.provider || "META_CLOUD") as string;
    const sourceMeta = source?.provider_config?.meta ?? undefined;
    const sourceWaha = source?.provider_config?.waha ?? undefined;
    const fallbackMeta: Partial<MetaProviderConfig> = {
      phone_number_id: source?.phone_number_id ?? undefined,
      waba_id: source?.waba_id ?? undefined,
      webhook_verify_token: source?.webhook_verify_token ?? undefined,
      refresh_token: sourceMeta?.refresh_token ?? undefined,
      provider_api_key: sourceMeta?.provider_api_key ?? undefined,
      access_token: sourceMeta?.access_token ?? undefined,
    };
    const metaConfig = provider === "META_CLOUD" ? toFormMeta(data.provider_config?.meta, fallbackMeta) : undefined;
    const wahaConfig = provider === "WAHA" ? toFormWaha(data.provider_config?.waha ?? sourceWaha) : undefined;
    const providerConfig =
      metaConfig || wahaConfig
        ? {
            ...(metaConfig ? { meta: metaConfig } : {}),
            ...(wahaConfig ? { waha: wahaConfig } : {}),
          }
        : data.provider_config;
    const normalized: InboxFormExtended = {
      ...data,
      provider,
      webhook_url: provider === "META_CLOUD" ? META_WEBHOOK_URL : data.webhook_url ?? "",
      provider_config: providerConfig,
      name: data.name ?? "",
      phone_number: data.phone_number ?? "",
      channel: data.channel || "WHATSAPP",
      is_active: data.is_active ?? true,
      base_url: data.base_url ?? source?.base_url ?? "",
      api_version: data.api_version ?? source?.api_version ?? "",
      instance_id: data.instance_id ?? source?.instance_id ?? source?.phone_number_id ?? "",
      phone_number_id: data.phone_number_id ?? source?.phone_number_id ?? "",
    };
    if (provider === "WAHA") {
      normalized.webhook_url = "";
      if (!normalized.base_url) normalized.base_url = "";
      if (!normalized.instance_id) {
        normalized.instance_id = source?.instance_id ?? source?.phone_number_id ?? "";
      }
      if (!normalized.phone_number_id && normalized.instance_id) {
        normalized.phone_number_id = normalized.instance_id;
      }
      if (!wahaConfig) {
        delete (normalized as any).provider_config;
      }
    }
    return normalized;
  }, []);

  const fetchInboxes = useCallback(async () => {
    try {
      setLoading(true);
      const [profile, inboxList] = await Promise.all([
        fetchJson<any>(`${API}/auth/me`),
        fetchJson<Inbox[]>(`${API}/settings/inboxes`),
      ]);

      setCompanyId(profile.companyId);
      const list = Array.isArray(inboxList) ? inboxList : [];
      setCompanyInboxes(list);

      const forms: Record<string, InboxFormExtended> = {};
      const baselineMap: Record<string, InboxFormExtended> = {};
      for (const inbox of list) {
        const provider = (inbox as any).provider || "META_CLOUD";
        const providerMeta = ((inbox as any).provider_config?.meta ?? null) as MetaProviderConfig | null;
        const fallbackMeta: Partial<MetaProviderConfig> = {
          phone_number_id: (inbox as any).phone_number_id ?? undefined,
          waba_id: (inbox as any).waba_id ?? undefined,
          webhook_verify_token: (inbox as any).webhook_verify_token ?? undefined,
        };
        const data: InboxFormExtended = {
          name: inbox.name || "",
          phone_number: inbox.phone_number || "",
          webhook_url: provider === "META_CLOUD"
            ? META_WEBHOOK_URL
            : (((inbox as any).webhook_url as string | null) ?? ""),
          is_active: !!inbox.is_active,
          provider,
          channel: (inbox as any).channel || "WHATSAPP",
          provider_config: provider === "META_CLOUD" ? { meta: toFormMeta(providerMeta, fallbackMeta) } : undefined,
          base_url: (inbox as any).base_url || "",
          api_version: (inbox as any).api_version || "",
          instance_id: (inbox as any).instance_id || (inbox as any).phone_number_id || "",
          phone_number_id: (inbox as any).phone_number_id || "",
        };
        forms[inbox.id] = data;
        baselineMap[inbox.id] = { ...data };
      }
      setInboxForms(forms);
      setInboxBaseline(baselineMap);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar caixas de entrada");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInboxes();
  }, [fetchInboxes]);

  const buildTempWahaSession = (rawName: string) => {
    const safeName = (rawName || "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "") || "WAHA";
    const safeCompany = (companyId || "COMPANY")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "") || "COMPANY";
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${safeName}_${safeCompany}_${random}`;
  };

  const normalizeInboxPayload = (data: InboxFormExtended) => {
    const metaPayload = data.provider === "META_CLOUD" ? buildMetaPayload(data.provider_config?.meta ?? undefined) : undefined;
    const wahaPayload = data.provider === "WAHA" ? buildWahaPayload(data.provider_config?.waha ?? undefined) : undefined;
    let providerConfig =
      metaPayload || wahaPayload
        ? {
            ...(metaPayload ? { meta: metaPayload } : {}),
            ...(wahaPayload ? { waha: wahaPayload } : {}),
          }
        : data.provider_config;

    const payload: Record<string, any> = {
      name: data.name,
      phone_number: data.phone_number,
      channel: data.channel || "WHATSAPP",
      provider: data.provider,
      is_active: data.is_active,
      webhook_url: data.provider === "META_CLOUD" ? META_WEBHOOK_URL : sanitizeToNull(data.webhook_url) ?? null,
      base_url: sanitizeToNull(data.base_url),
      api_version: sanitizeToNull(data.api_version),
      instance_id: sanitizeToNull(data.instance_id),
      provider_config: providerConfig,
    };

    if ((data.provider || "").toUpperCase() === "WAHA") {
      const fallback = buildTempWahaSession(data.name || data.instance_id || data.phone_number || "");
      const normalizedPhone = data.phone_number?.trim();
      const normalizedInstance = data.instance_id?.trim();
      const normalizedSession =
        (data.phone_number_id && data.phone_number_id.trim().length >= 3
          ? data.phone_number_id.trim()
          : undefined) ||
        (normalizedInstance && normalizedInstance.length >= 3 ? normalizedInstance : undefined) ||
        fallback;
      payload.phone_number =
        normalizedPhone && normalizedPhone.length >= 5
          ? normalizedPhone
          : `PENDING_${normalizedSession.slice(0, 20)}`;
      payload.instance_id = normalizedSession;
      payload.phone_number_id = normalizedSession;
      payload.webhook_url = null;
      payload.base_url = null;
      payload.api_version = null;
      payload.provider_config = undefined;
      payload.channel = "WHATSAPP";
    }
    return payload;
  };

  const handleSaveInbox = async (id: string, data: InboxFormExtended) => {
    const payload = normalizeInboxPayload(data);
    try {
      const updated = await fetchJson<Inbox>(`${API}/settings/inboxes/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const formData = normalizeInboxForm(
        {
          name: updated?.name ?? data.name,
          phone_number: updated?.phone_number ?? data.phone_number,
          webhook_url: updated?.webhook_url ?? payload.webhook_url,
          is_active: !!updated?.is_active,
          provider: updated?.provider || data.provider,
          channel: updated?.channel || data.channel,
          provider_config: updated?.provider_config || data.provider_config,
          base_url: updated?.base_url ?? data.base_url,
          api_version: updated?.api_version ?? data.api_version,
          instance_id: updated?.instance_id ?? data.instance_id,
          phone_number_id: updated?.phone_number_id ?? data.phone_number_id,
        },
        updated,
      );
      setInboxForms((prev) => ({ ...prev, [id]: formData }));
      setInboxBaseline((prev) => ({ ...prev, [id]: { ...formData } }));
      setCompanyInboxes((prev) =>
        prev.map((entry) => {
          if (entry.id !== id) return entry;
          const provider = updated?.provider || entry.provider || "META_CLOUD";
          return {
            ...entry,
            ...updated,
            webhook_url:
              provider === "META_CLOUD"
                ? META_WEBHOOK_URL
                : updated?.webhook_url || entry.webhook_url,
          };
        }),
      );
    } catch (err: any) {
      console.error("Erro ao salvar caixa:", err);
      throw err;
    }
  };

  return {
    companyInboxes,
    setCompanyInboxes,
    inboxForms,
    setInboxForms,
    inboxBaseline,
    setInboxBaseline,
    loading,
    error,
    companyId,
    handleSaveInbox,
    metaWebhookUrl: META_WEBHOOK_URL,
    refetch: fetchInboxes,
  };
}
