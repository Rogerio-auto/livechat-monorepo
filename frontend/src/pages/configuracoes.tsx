import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaCalendar, FaPlus, FaTrash, FaEdit, FaLock, FaUsers, FaEye, FaCog, FaBan, FaCheck, FaMoneyBillWave } from "react-icons/fa";
import Sidebar from "../componets/Sidbars/sidebar";
import SettingsNav from "../componets/settings/SettingsNav";
import EmpresaPanel, { type CompanyForm } from "../componets/company/EmpresaPanel";
import PerfilPanel, { type ProfileForm } from "../componets/profile/PerfilPanel";
import InboxesPanel from "../componets/inboxes/InboxesPanel";
import IntegracoesPanel from "../componets/integrations/IntegracoesPanel";
import OpenAIBillingPanel from "../componets/billing/OpenAIBillingPanel";
import { SimplifiedAgentPanel } from "../componets/agents/SimplifiedAgentPanel";
import { KnowledgeBasePanel } from "../componets/knowledge/KnowledgeBasePanel";
import AgentesPanel from "../componets/users/AgentesPanel";
import { DepartmentsManager } from "../componets/admin/DepartmentsManager";
import { TeamsManager } from "../componets/admin/TeamsManager";
import { API, fetchJson } from "../utils/api";
import { showToast } from "../hooks/useToast";
import type {
  Inbox,
  InboxForm,
  InboxFormExtended,
  MetaProviderConfig,
  ProviderConfig,
  WahaProviderConfig,
} from "../types/types";

// ======= PALETA (SION) =======
const SECTIONS = [
  { id: "empresa", title: "Empresa", subtitle: "Dados e plano ativo", restrictTo: ["ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "SUPER_ADMIN"] },
  { id: "perfil", title: "Perfil", subtitle: "Seu nome, avatar e senha" },
  { id: "inboxes", title: "Caixas de entrada", subtitle: "Canais conectados", restrictTo: ["ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "SUPER_ADMIN"] },
  { id: "integracoes", title: "Integracoes", subtitle: "Loja de integracoes", restrictTo: ["ADMIN", "MANAGER", "SUPERVISOR", "TECHNICIAN", "SUPER_ADMIN"] },
  { id: "billing", title: "Faturamento", subtitle: "Uso de IA e faturas", restrictTo: ["ADMIN", "MANAGER", "SUPER_ADMIN"] },
  { id: "ia", title: "IA", subtitle: "Agentes e modelos" },
  { id: "colaborador", title: "Colaborador", subtitle: "Usuarios e permissoes", restrictTo: ["ADMIN", "MANAGER", "SUPERVISOR", "SUPER_ADMIN"] },
  { id: "departamentos", title: "Departamentos", subtitle: "Organizar em departamentos", restrictTo: ["ADMIN", "MANAGER", "SUPER_ADMIN"] },
  { id: "times", title: "Times", subtitle: "Gerenciar equipes e horários", restrictTo: ["ADMIN", "MANAGER", "SUPER_ADMIN"] },
  { id: "calendarios", title: "Calendários", subtitle: "Gerenciar calendários", restrictTo: ["ADMIN", "MANAGER", "SUPERVISOR", "SUPER_ADMIN"] },
  { id: "permissoes-calendario", title: "Permissões de Calendário", subtitle: "Compartilhar calendários", restrictTo: ["ADMIN", "MANAGER", "SUPERVISOR", "SUPER_ADMIN"] },
] as const;

type TabId = typeof SECTIONS[number]["id"];

type FetchProfileResponse = {
  id?: string;
  name?: string | null;
  companyName?: string | null;
  companyId?: string | null;
  avatarUrl?: string | null;
  role?: string | null;
};

type FetchCompanyResponse = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  logo?: string | null;
};



// Extendemos o InboxForm so no front, sem quebrar tipagem existente
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

const sanitizeToNull = (value?: string | null) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildMetaPayload = (meta?: MetaProviderConfig | null) => {
  if (!meta) return undefined;
  const result: MetaProviderConfig = {};
  const assign = (key: keyof MetaProviderConfig) => {
    const normalized = sanitizeToNull(meta[key]);
    if (normalized !== undefined) {
      result[key] = normalized as any;
    }
  };
  assign("access_token");
  assign("refresh_token");
  assign("provider_api_key");
  assign("phone_number_id");
  assign("waba_id");
  assign("webhook_verify_token");
  assign("app_secret");
  return Object.keys(result).length > 0 ? result : undefined;
};

const buildWahaPayload = (waha?: WahaProviderConfig | null) => {
  if (!waha) return undefined;
  const apiKey = sanitizeToNull(waha.api_key);
  if (apiKey === undefined) return undefined;
  return { api_key: apiKey };
};

const INPUT_BASE = "config-input w-full rounded-xl px-3 py-2 disabled:opacity-60";
const LABEL = "block text-sm config-text-muted mb-1";
const CARD = "config-card rounded-xl shadow-sm p-6";
const SOFT_BTN = "config-btn px-3 py-2 rounded-lg";
const PRIMARY_BTN = "config-btn-primary px-3 py-2 rounded-lg";

const META_WEBHOOK_URL =
  (typeof (import.meta as any).env?.VITE_META_WEBHOOK_URL === "string" &&
    (import.meta as any).env.VITE_META_WEBHOOK_URL)
    ? (import.meta as any).env.VITE_META_WEBHOOK_URL
    : `${API}/integrations/meta/webhook`;

const generateVerifyToken = () =>
  Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

const EMPTY_INBOX_FORM: InboxFormExtended = {
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

const EMPTY_WAHA_FORM: InboxFormExtended = {
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

// ======= HELPERS =======
export default function ConfiguracoesPage() {
  const navigate = useNavigate();
  const { search } = useLocation();

  const getTabFromURL = (): TabId => {
    const q = new URLSearchParams(search).get("tab") as TabId | null;
    return (SECTIONS.find((s) => s.id === q)?.id || SECTIONS[0].id) as TabId;
  };

  const [tab, setTab] = useState<TabId>(() => getTabFromURL());
  useEffect(() => setTab(getTabFromURL()), [search]);

  const goTab = (next: TabId) => {
    setTab(next);
    const qs = new URLSearchParams(search);
    qs.set("tab", next);
    navigate({ search: `?${qs.toString()}` });
  };

  const [loading, setLoading] = useState(false);

  const [companyForm, setCompanyForm] = useState<CompanyForm>({ empresa: "", endereco: "", cidade: "", uf: "", logoUrl: "" });
  const [companyBaseline, setCompanyBaseline] = useState<CompanyForm>({ empresa: "", endereco: "", cidade: "", uf: "", logoUrl: "" });

  const [profileForm, setProfileForm] = useState<ProfileForm>({ nome: "", avatarUrl: "", senhaAtual: "", novaSenha: "", confirmarSenha: "" });
  const [profileBaseline, setProfileBaseline] = useState<{ nome: string; avatarUrl: string }>({ nome: "", avatarUrl: "" });

  const [companyInboxes, setCompanyInboxes] = useState<Inbox[]>([]);
  const [inboxForms, setInboxForms] = useState<Record<string, InboxFormExtended>>({});
  const [inboxBaseline, setInboxBaseline] = useState<Record<string, InboxFormExtended>>({});

  const [providerPickerOpen, setProviderPickerOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createInboxForm, setCreateInboxForm] = useState<InboxFormExtended>({ ...EMPTY_INBOX_FORM });
  const [createSaving, setCreateSaving] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [lastCreatedInboxId, setLastCreatedInboxId] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Inbox | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // ======= STATES PARA CALENDÁRIOS =======
  const [calendars, setCalendars] = useState<any[]>([]);
  const [newCalendar, setNewCalendar] = useState({
    name: "",
    type: "PERSONAL" as "PERSONAL" | "TEAM" | "COMPANY" | "PROJECT",
    color: "#3B82F6",
    description: "",
  });

  // ======= STATES PARA PERMISSÕES =======
  const [selectedCalendarForPermissions, setSelectedCalendarForPermissions] = useState<string>("");
  const [permissions, setPermissions] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [newPermission, setNewPermission] = useState({
    user_id: "",
    can_view: true,
    can_edit: false,
    can_create_events: false,
    can_manage: false,
  });

  // Seções visíveis conforme role (IA apenas para ADMIN/MANAGER/SUPERVISOR)
  const sections = useMemo(() => {
    const role = String(profileRole || "").toUpperCase();
    return SECTIONS.filter((s) => {
      // Se a seção tem restrição de role, verifica
      if ('restrictTo' in s && Array.isArray(s.restrictTo)) {
        return s.restrictTo.includes(role);
      }
      // Para IA, mantém a restrição antiga
      if (s.id === "ia") {
        return ["ADMIN", "MANAGER", "SUPERVISOR"].includes(role);
      }
      return true;
    });
  }, [profileRole]);


  // If current tab becomes hidden for the user's role, redirect to first allowed
  useEffect(() => {
    const visibleIds = sections.map((s) => s.id);
    if (!visibleIds.includes(tab)) {
      const next = (sections[0]?.id ?? SECTIONS[0].id) as TabId;
      if (next !== tab) {
        const qs = new URLSearchParams(search);
        qs.set("tab", next);
        navigate({ search: `?${qs.toString()}` });
      }
    }
  }, [sections, tab, navigate, search]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [profileData, companyData, inboxList] = await Promise.all([
          fetchJson<FetchProfileResponse>(`${API}/me/profile`).catch(() => null),
          fetchJson<FetchCompanyResponse | null>(`${API}/companies/me`).catch(() => null),
          fetchJson<Inbox[]>(`${API}/settings/inboxes`).catch(() => []),
        ]);

        if (!active) return;

        if (profileData) {
          setProfileForm((prev) => ({
            ...prev,
            nome: profileData.name || "",
            avatarUrl: profileData.avatarUrl || "",
          }));
          setProfileBaseline({ nome: profileData.name || "", avatarUrl: profileData.avatarUrl || "" });
          setCompanyId(profileData.companyId || null);
          setProfileRole(profileData.role || null);
        }

        if (companyData) {
          const company: CompanyForm = {
            empresa: companyData.name || "",
            endereco: companyData.address || "",
            cidade: companyData.city || "",
            uf: companyData.state || "",
            logoUrl: companyData.logo || "",
          };
          setCompanyForm(company);
          setCompanyBaseline(company);
        }

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
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

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
    const metaPayload = data.provider === "META_CLOUD" ? buildMetaPayload(data.provider_config?.meta) : undefined;
    const wahaPayload = data.provider === "WAHA" ? buildWahaPayload(data.provider_config?.waha) : undefined;
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
      providerConfig = undefined;
    }
    return payload;
  };

  const normalizeInboxForm = (
    data: Partial<InboxFormExtended> & { webhook_url?: string | null },
    source?: Partial<Inbox>,
  ) => {
    const provider = (data.provider || source?.provider || "META_CLOUD") as string;
    const sourceMeta = source?.provider_config?.meta || undefined;
    const sourceWaha = source?.provider_config?.waha || undefined;
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
                : updated?.webhook_url ?? entry.webhook_url ?? null,
          };
        }),
      );
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Falha ao salvar inbox";
      showToast(message, "error");
      setInboxForms((prev) => ({ ...prev, [id]: { ...(inboxBaseline[id] || data) } }));
    }
  };

  const openProviderPicker = () => {
    setProviderPickerOpen(true);
  };

  const openCreateModalForProvider = (provider: "META_CLOUD" | "WAHA") => {
    setCreateInboxForm(provider === "META_CLOUD" ? { ...EMPTY_INBOX_FORM } : { ...EMPTY_WAHA_FORM });
    setProviderPickerOpen(false);
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (createSaving) return;
    setCreateModalOpen(false);
    setProviderPickerOpen(false);
    setCreateInboxForm({ ...EMPTY_INBOX_FORM });
  };

  const isMeta = useMemo(() => createInboxForm.provider === "META_CLOUD", [createInboxForm.provider]);
  const isWaha = useMemo(() => createInboxForm.provider === "WAHA", [createInboxForm.provider]);

  const submitCreateInbox = async () => {
    const trimmedName = createInboxForm.name.trim();
    if (!trimmedName) {
      showToast("Informe um nome para a conexao", "warning");
      return;
    }
    if (isMeta && !createInboxForm.phone_number.trim()) {
      showToast("Preencha nome e telefone", "warning");
      return;
    }
    if (isMeta) {
      const m = createInboxForm.provider_config?.meta || DEFAULT_META;
      if (
        !(m.access_token?.trim()) ||
        !(m.phone_number_id?.trim()) ||
          !(m.waba_id?.trim()) ||
          !(m.webhook_verify_token?.trim())
      ) {
        showToast("Preencha todos os campos da Meta (access token, phone_number_id, waba_id e verify token).", "warning");
        return;
      }
    }
    let formToSubmit: InboxFormExtended = { ...createInboxForm, name: trimmedName };
    if (isWaha) {
      formToSubmit = {
        ...formToSubmit,
        instance_id: createInboxForm.instance_id?.trim() || "",
        phone_number: createInboxForm.phone_number?.trim() || "",
        phone_number_id: createInboxForm.phone_number_id?.trim() || "",
        channel: "WHATSAPP",
        webhook_url: "",
        provider_config: undefined,
        base_url: "",
        api_version: "",
      };
    }
    setCreateSaving(true);
    try {
      const payload = normalizeInboxPayload(formToSubmit);
      const created = await fetchJson<Inbox>(`${API}/settings/inboxes`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const mapped = normalizeInboxForm(
        {
          name: created?.name || formToSubmit.name,
          phone_number: created?.phone_number || formToSubmit.phone_number,
          webhook_url: created?.webhook_url ?? payload.webhook_url ?? "",
          is_active: !!created?.is_active,
          provider: created?.provider || formToSubmit.provider,
          channel: created?.channel || formToSubmit.channel,
          provider_config: created?.provider_config || formToSubmit.provider_config,
          base_url: created?.base_url ?? formToSubmit.base_url,
          api_version: created?.api_version ?? formToSubmit.api_version,
          instance_id: created?.instance_id ?? formToSubmit.instance_id,
          phone_number_id: created?.phone_number_id ?? formToSubmit.phone_number_id,
        },
        created,
      );
      const normalizedCreated =
        (created?.provider || formToSubmit.provider) === "META_CLOUD"
          ? { ...created, webhook_url: META_WEBHOOK_URL }
          : created;
      setCompanyInboxes((prev) => [normalizedCreated, ...prev]);
      setInboxForms((prev) => ({ ...prev, [created.id]: mapped }));
      setInboxBaseline((prev) => ({ ...prev, [created.id]: { ...mapped } }));
      setLastCreatedInboxId(created.id);
      setCreateInboxForm({ ...EMPTY_INBOX_FORM });
      setCreateModalOpen(false);
      setProviderPickerOpen(false);
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Falha ao criar inbox";
      showToast(message, "error");
    } finally {
      setCreateSaving(false);
    }
  };

  const requestDeleteInbox = (id: string) => {
    const target = companyInboxes.find((entry) => entry.id === id) || null;
    setDeleteTarget(target);
  };

  const closeDeleteModal = () => {
    if (!deleteSaving) setDeleteTarget(null);
  };

  const confirmDeleteInbox = async () => {
    if (!deleteTarget) return;
    setDeleteSaving(true);
    try {
      const res = await fetch(`${API}/settings/inboxes/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
          const payload = await res.json();
          if (payload?.error) message = payload.error;
        } catch {
          // ignore parse errors
        }
        throw new Error(message);
      }
      setCompanyInboxes((prev) => prev.filter((entry) => entry.id !== deleteTarget.id));
      setInboxForms((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      setInboxBaseline((prev) => {
        const next = { ...prev };
        delete next[deleteTarget.id];
        return next;
      });
      setDeleteTarget(null);
    } catch (error: any) {
      const message = typeof error?.message === "string" ? error.message : "Falha ao excluir inbox";
      showToast(message, "error");
    } finally {
      setDeleteSaving(false);
    }
  };

  // ======= FUNÇÕES PARA GERENCIAR CALENDÁRIOS =======
  const loadCalendars = async () => {
    try {
      const data = await fetchJson<any[]>(`${API}/calendar/calendars`);
      setCalendars(data || []);
    } catch (e: any) {
      console.error("Erro ao carregar calendários:", e);
    }
  };

  const handleCreateCalendar = async () => {
    if (!newCalendar.name.trim()) {
      showToast("Digite um nome para o calendário", "warning");
      return;
    }
    try {
      await fetchJson(`${API}/calendar/calendars`, {
        method: "POST",
        body: JSON.stringify({
          name: newCalendar.name,
          type: newCalendar.type,
          color: newCalendar.color,
          description: newCalendar.description || null,
        }),
      });
      setNewCalendar({ name: "", type: "PERSONAL", color: "#3B82F6", description: "" });
      await loadCalendars();
      showToast("Calendário criado com sucesso!", "success");
    } catch (e: any) {
      console.error("Erro ao criar calendário:", e);
      showToast(e.message || "Erro ao criar calendário", "error");
    }
  };

  const handleDeleteCalendar = async (calendarId: string) => {
    if (!confirm("Tem certeza que deseja deletar este calendário?")) return;
    try {
      await fetchJson(`${API}/calendar/calendars/${calendarId}`, { method: "DELETE" });
      await loadCalendars();
      showToast("Calendário deletado com sucesso!", "success");
    } catch (e: any) {
      console.error("Erro ao deletar calendário:", e);
      showToast(e.message || "Erro ao deletar calendário", "error");
    }
  };

  // ======= FUNÇÕES PARA GERENCIAR PERMISSÕES =======
  const loadAllUsers = async () => {
    try {
      const data = await fetchJson<any[]>(`${API}/settings/users`);
      setAllUsers(data || []);
    } catch (e: any) {
      console.error("Erro ao carregar usuários:", e);
    }
  };

  const loadPermissions = async (calendarId: string) => {
    if (!calendarId) {
      setPermissions([]);
      return;
    }
    try {
      const data = await fetchJson<any[]>(`${API}/calendar/${calendarId}/permissions`);
      setPermissions(data || []);
    } catch (e: any) {
      console.error("Erro ao carregar permissões:", e);
      setPermissions([]);
    }
  };

  const handleGrantAccess = async () => {
    if (!selectedCalendarForPermissions || !newPermission.user_id) {
      showToast("Selecione um calendário e um usuário", "warning");
      return;
    }
    try {
      await fetchJson(`${API}/calendar/${selectedCalendarForPermissions}/permissions`, {
        method: "POST",
        body: JSON.stringify(newPermission),
      });
      setNewPermission({
        user_id: "",
        can_view: true,
        can_edit: false,
        can_create_events: false,
        can_manage: false,
      });
      await loadPermissions(selectedCalendarForPermissions);
      showToast("Acesso concedido com sucesso!", "success");
    } catch (e: any) {
      console.error("Erro ao conceder acesso:", e);
      showToast(e.message || "Erro ao conceder acesso", "error");
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!confirm("Tem certeza que deseja revogar o acesso deste usuário?")) return;
    try {
      await fetchJson(`${API}/calendar/${selectedCalendarForPermissions}/permissions/${userId}`, {
        method: "DELETE",
      });
      await loadPermissions(selectedCalendarForPermissions);
      showToast("Acesso revogado com sucesso!", "success");
    } catch (e: any) {
      console.error("Erro ao revogar acesso:", e);
      showToast(e.message || "Erro ao revogar acesso", "error");
    }
  };

  // Carregar calendários quando a tab de calendários for aberta
  useEffect(() => {
    if (tab === "calendarios") {
      loadCalendars();
    }
  }, [tab]);

  // Carregar usuários quando a tab de permissões for aberta
  useEffect(() => {
    if (tab === "permissoes-calendario") {
      loadCalendars();
      loadAllUsers();
    }
  }, [tab]);

  // Carregar permissões quando selecionar um calendário
  useEffect(() => {
    if (selectedCalendarForPermissions) {
      loadPermissions(selectedCalendarForPermissions);
    }
  }, [selectedCalendarForPermissions]);

  return (
  <div className="config-page ml-16 min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-blue-900/20 transition-colors duration-300">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-4rem)] p-6">
          {/* Sidebar de navegação */}
          <div className="col-span-12 md:col-span-2">
            <div className="p-4 sticky top-6 transition-colors duration-300">
              <SettingsNav sections={[...sections]} current={tab} onChange={(id) => goTab(id as TabId)} />
            </div>
          </div>

          {/* Conteúdo principal */}
          <div className="col-span-12 md:col-span-10 overflow-y-auto pr-1 space-y-6">
            {tab === "empresa" && (
              <div className="p-8 transition-colors duration-300">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-600/20 flex items-center justify-center transition-colors duration-300">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    Empresa
                  </h2>
                  <p className="text-gray-400 mt-1">Gerencie dados da empresa{["ADMIN", "MANAGER", "SUPERVISOR"].includes(String(profileRole || "").toUpperCase()) && " e plano ativo"}</p>
                </div>
                <EmpresaPanel
                  form={companyForm}
                  baseline={companyBaseline}
                  setForm={setCompanyForm}
                  onSaved={(next) => {
                    setCompanyForm(next);
                    setCompanyBaseline(next);
                  }}
                  disabled={loading}
                  userRole={profileRole}
                />
              </div>
            )}

            {tab === "perfil" && (
              <div className="p-8 transition-colors duration-300">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-600/20 flex items-center justify-center transition-colors duration-300">
                      <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    Perfil
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Seu nome, avatar e senha</p>
                </div>
                <PerfilPanel
                  form={profileForm}
                  baseline={profileBaseline}
                  setForm={setProfileForm}
                  onSaved={(next) => {
                    setProfileForm((prev) => ({ ...prev, ...next }));
                    setProfileBaseline(next);
                  }}
                  disabled={loading}
                />
              </div>
            )}

            {tab === "inboxes" && (
              <div className="p-8 transition-colors duration-300">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-600/20 flex items-center justify-center transition-colors duration-300">
                      <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </div>
                    Caixas de Entrada
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Gerencie seus canais conectados</p>
                </div>
                <InboxesPanel
                  companyInboxes={companyInboxes}
                  forms={inboxForms}
                  baseline={inboxBaseline}
                  setCompanyInboxes={setCompanyInboxes}
                  setForms={setInboxForms}
                  setBaseline={setInboxBaseline}
                  onSave={handleSaveInbox}
                  onRequestDelete={requestDeleteInbox}
                  metaWebhookUrl={META_WEBHOOK_URL}
                  disabled={loading}
                  initialExpandedId={lastCreatedInboxId}
                  onExpandedChange={(id) =>
                    setLastCreatedInboxId((prev) =>
                      prev && (id === prev || id === null) ? null : prev
                    )
                  }
                />
              </div>
            )}

            {tab === "integracoes" && (
              <div className="p-8 transition-colors duration-300">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-600/20 flex items-center justify-center transition-colors duration-300">
                      <svg className="w-6 h-6 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                      </svg>
                    </div>
                    Integrações
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Conecte ferramentas externas</p>
                </div>
                <IntegracoesPanel />
              </div>
            )}

            {tab === "billing" && (
              <div className="p-8 transition-colors duration-300">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-600/20 flex items-center justify-center transition-colors duration-300">
                      <FaMoneyBillWave className="w-6 h-6 text-green-600 dark:text-green-400" />
                    </div>
                    Faturamento e Uso de IA
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Acompanhe o consumo de tokens e faturas</p>
                </div>
                <OpenAIBillingPanel />
              </div>
            )}
            
            {tab === "ia" && (() => {
              const role = String(profileRole || "").toUpperCase();
              const allowed = role === "ADMIN" || role === "MANAGER" || role === "SUPERVISOR" || role === "SUPER_ADMIN";
              if (!allowed) {
                return (
                  <div className="p-8 transition-colors duration-300">
                    <div className="text-gray-900 dark:text-white">Você não tem permissão para configurar agentes.</div>
                  </div>
                );
              }
              return (
                <>
                  <SimplifiedAgentPanel />
                  <div className="mt-6">
                    <KnowledgeBasePanel />
                  </div>
                </>
              );
            })()}
            
            {tab === "colaborador" && (
              <div className="p-8 transition-colors duration-300">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-600/20 flex items-center justify-center transition-colors duration-300">
                      <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    Colaboradores
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Gerencie usuários e permissões</p>
                </div>
                <AgentesPanel />
              </div>
            )}

            {tab === "departamentos" && (
              <div className="p-8 transition-colors duration-300">
                <DepartmentsManager />
              </div>
            )}

            {tab === "times" && (
              <div className="p-8 transition-colors duration-300">
                <TeamsManager />
              </div>
            )}

            {/* TAB: CALENDÁRIOS */}
            {tab === "calendarios" && (
              <div className="p-8 transition-colors duration-300">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-600/20 flex items-center justify-center transition-colors duration-300">
                      <FaCalendar className="text-purple-600 dark:text-purple-400" />
                    </div>
                    Gerenciar Calendários
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Crie, edite ou delete calendários pessoais e da empresa</p>
                </div>

                {/* Lista de Calendários */}
                <div className="space-y-4 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Calendários Existentes</h3>
                  <div className="grid gap-3">
                    {calendars.map((cal) => (
                      <div
                        key={cal.id}
                        className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 transition-colors duration-300"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: cal.color }}
                          />
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-white">
                              {cal.name}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {cal.type || "COMPANY"} {cal.is_default && "• Padrão"}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => showToast("Função de editar calendário ainda não implementada", "info")}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all flex items-center gap-1"
                          >
                            <FaEdit /> Editar
                          </button>
                          {!cal.is_default && (
                            <button
                              onClick={() => handleDeleteCalendar(cal.id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all flex items-center gap-1"
                            >
                              <FaTrash /> Deletar
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formulário Criar Calendário */}
                <div className="p-6 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10 transition-colors duration-300">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <FaPlus /> Criar Novo Calendário
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Nome do Calendário
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: Reuniões Comerciais"
                        value={newCalendar.name}
                        onChange={(e) => setNewCalendar({ ...newCalendar, name: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 transition-colors duration-300"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tipo
                      </label>
                      <select
                        value={newCalendar.type}
                        onChange={(e) => setNewCalendar({ ...newCalendar, type: e.target.value as any })}
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 transition-colors duration-300"
                      >
                        <option value="COMPANY">Empresa</option>
                        <option value="PERSONAL">Pessoal</option>
                        <option value="TEAM">Equipe</option>
                        <option value="PROJECT">Projeto</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Cor
                      </label>
                      <input
                        type="color"
                        value={newCalendar.color}
                        onChange={(e) => setNewCalendar({ ...newCalendar, color: e.target.value })}
                        className="w-full h-10 rounded-lg border border-gray-300 dark:border-gray-600"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={handleCreateCalendar}
                        className="w-full px-4 py-2 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 transition-all flex items-center justify-center gap-2"
                      >
                        <FaPlus /> Criar Calendário
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: PERMISSÕES DE CALENDÁRIO */}
            {tab === "permissoes-calendario" && (
              <div className="p-8 transition-colors duration-300">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-600/20 flex items-center justify-center transition-colors duration-300">
                      <FaLock className="text-amber-600 dark:text-amber-400" />
                    </div>
                    Gerenciar Permissões
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Compartilhe calendários e gerencie permissões de acesso</p>
                </div>

                <div className="space-y-6">
                  {/* Seletor de Calendário */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Selecione o Calendário
                    </label>
                    <select
                      value={selectedCalendarForPermissions}
                      onChange={(e) => setSelectedCalendarForPermissions(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-colors duration-300"
                    >
                      <option value="">Escolha um calendário...</option>
                      {calendars.map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Permissões Atuais */}
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                      <FaUsers /> Usuários com Acesso
                    </h3>
                    <div className="space-y-2">
                      {!selectedCalendarForPermissions && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                          Selecione um calendário para ver as permissões
                        </p>
                      )}
                      {selectedCalendarForPermissions && permissions.length === 0 && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                          Nenhuma permissão concedida ainda
                        </p>
                      )}
                      {permissions.map((perm) => (
                        <div
                          key={perm.user_id}
                          className="flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 transition-colors duration-300"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-sm">
                              {perm.users?.name?.substring(0, 2).toUpperCase() || "??"}
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-white">
                                {perm.users?.name || "Usuário desconhecido"}
                              </h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {perm.users?.email || ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex gap-2 text-xs flex-wrap">
                              {perm.can_view && (
                                <span className="px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 flex items-center gap-1">
                                  <FaEye /> Ver
                                </span>
                              )}
                              {perm.can_edit && (
                                <span className="px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                                  <FaEdit /> Editar
                                </span>
                              )}
                              {perm.can_create_events && (
                                <span className="px-2 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 flex items-center gap-1">
                                  <FaPlus /> Criar
                                </span>
                              )}
                              {perm.can_manage && (
                                <span className="px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 flex items-center gap-1">
                                  <FaCog /> Gerenciar
                                </span>
                              )}
                            </div>
                            <button
                              onClick={() => handleRevokeAccess(perm.user_id)}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all flex items-center gap-1"
                            >
                              <FaBan /> Revogar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Adicionar Novo Acesso */}
                  {selectedCalendarForPermissions && (
                    <div className="p-6 rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10 transition-colors duration-300">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <FaPlus /> Conceder Novo Acesso
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Usuário
                          </label>
                          <select
                            value={newPermission.user_id}
                            onChange={(e) => setNewPermission({ ...newPermission, user_id: e.target.value })}
                            className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 transition-colors duration-300"
                          >
                            <option value="">Selecione um usuário...</option>
                            {allUsers.map((user) => (
                              <option key={user.id} value={user.id}>
                                {user.name || user.email}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Permissões
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="flex items-center gap-2 p-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors duration-300">
                              <input
                                type="checkbox"
                                checked={newPermission.can_view}
                                onChange={(e) => setNewPermission({ ...newPermission, can_view: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <FaEye /> Visualizar
                              </span>
                            </label>
                            <label className="flex items-center gap-2 p-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors duration-300">
                              <input
                                type="checkbox"
                                checked={newPermission.can_edit}
                                onChange={(e) => setNewPermission({ ...newPermission, can_edit: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <FaEdit /> Editar
                              </span>
                            </label>
                            <label className="flex items-center gap-2 p-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors duration-300">
                              <input
                                type="checkbox"
                                checked={newPermission.can_create_events}
                                onChange={(e) => setNewPermission({ ...newPermission, can_create_events: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <FaPlus /> Criar Eventos
                              </span>
                            </label>
                            <label className="flex items-center gap-2 p-3 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors duration-300">
                              <input
                                type="checkbox"
                                checked={newPermission.can_manage}
                                onChange={(e) => setNewPermission({ ...newPermission, can_manage: e.target.checked })}
                                className="rounded"
                              />
                              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                                <FaCog /> Gerenciar
                              </span>
                            </label>
                          </div>
                        </div>
                        <div className="col-span-2">
                          <button
                            onClick={handleGrantAccess}
                            className="w-full px-4 py-2.5 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-all flex items-center justify-center gap-2"
                          >
                            <FaCheck /> Conceder Acesso
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      {/* MODAL ESCOLHER TIPO DE CONEXÃO */}
      {providerPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl border border-gray-300 dark:border-gray-700 bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 p-8 shadow-md space-y-6 animate-fade-in transition-colors duration-300">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Qual serviço você quer usar?</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Escolha entre o provedor oficial da Meta ou a integração não oficial WAHA.
                </p>
              </div>
              <button
                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                type="button"
                onClick={() => {
                  if (!createSaving) {
                    setProviderPickerOpen(false);
                  }
                }}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => openCreateModalForProvider("META_CLOUD")}
                className="group rounded-xl border-2 border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 p-6 text-left transition-all hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/20 hover:scale-105 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-blue-200 dark:bg-blue-600/20 flex items-center justify-center text-sm font-bold text-blue-700 dark:text-blue-400 ring-2 ring-blue-300 dark:ring-blue-500/30">
                    META
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-300 transition">Oficial Meta Cloud</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">WhatsApp Business Platform</div>
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  Preencha os tokens oficiais (access token, phone_number_id, waba_id e verify token) para ativar a
                  integração aprovada pela Meta.
                </p>
              </button>

              <button
                type="button"
                onClick={() => openCreateModalForProvider("WAHA")}
                className="group rounded-xl border-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 p-6 text-left transition-all hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-500/20 hover:scale-105 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-12 w-12 rounded-full bg-emerald-200 dark:bg-emerald-600/20 flex items-center justify-center text-sm font-bold text-emerald-700 dark:text-emerald-400 ring-2 ring-emerald-300 dark:ring-emerald-500/30">
                    WAHA
                  </div>
                  <div>
                    <div className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-300 transition">WAHA</div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Pareamento via QR Code</div>
                  </div>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  Informe apenas o nome da conexão, gere o QR Code e conecte sua conta pelo navegador usando WhatsApp Web.
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CRIAR INBOX (com Meta) */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-gray-300 dark:border-gray-700 bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-md my-8 transition-colors duration-300">
            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-600/20 flex items-center justify-center transition-colors duration-300">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  Nova caixa de entrada
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">Configure uma nova conexão</p>
              </div>
              <div className="space-y-5">
                <div>
                  <label className={LABEL}>Nome</label>
                  <input
                    className={INPUT_BASE}
                    value={createInboxForm.name}
                    onChange={(e) =>
                      setCreateInboxForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    autoComplete="off"
                    disabled={createSaving}
                  />
                </div>
                {!isWaha && (
                  <div>
                    <label className={LABEL}>Telefone</label>
                    <input
                      className={INPUT_BASE}
                      value={createInboxForm.phone_number}
                      onChange={(e) => setCreateInboxForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                      autoComplete="off"
                      inputMode="tel"
                      disabled={createSaving}
                    />
                  </div>
                )}
                {!isWaha && (
                  <div>
                    <label className={LABEL}>Webhook URL</label>
                    <input
                      className={INPUT_BASE}
                      value={isMeta ? META_WEBHOOK_URL : createInboxForm.webhook_url ?? ""}
                      onChange={(e) =>
                        setCreateInboxForm((prev) => ({
                          ...prev,
                          webhook_url:
                            prev.provider === "META_CLOUD" ? META_WEBHOOK_URL : e.target.value,
                        }))
                      }
                      autoComplete="off"
                      disabled={createSaving || isMeta}
                      readOnly={isMeta}
                    />
                    {isMeta && (
                      <p className="mt-1 text-xs" style={{ color: "#94A3B8" }}>
                        Webhook fixo do sistema: {META_WEBHOOK_URL}
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={LABEL}>Provider</label>
                    <select
                      className={INPUT_BASE}
                      value={createInboxForm.provider}
                      onChange={(e) =>
                        setCreateInboxForm((prev) => {
                          const nextProvider = e.target.value as "META_CLOUD" | "WAHA" | "OTHER";
                          if (nextProvider === prev.provider) return prev;
                          if (nextProvider === "META_CLOUD") {
                            return { ...EMPTY_INBOX_FORM, name: prev.name };
                          }
                          if (nextProvider === "WAHA") {
                            return { ...EMPTY_WAHA_FORM, name: prev.name };
                          }
                          return { ...prev, provider: nextProvider };
                        })
                      }
                      disabled={createSaving}
                    >
                      <option value="META_CLOUD">Meta Cloud</option>
                      <option value="WAHA">WAHA</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  </div>
                  {!isWaha && (
                    <div>
                      <label className={LABEL}>Canal</label>
                      <select
                        className={INPUT_BASE}
                        value={createInboxForm.channel}
                        onChange={(e) => setCreateInboxForm((prev) => ({ ...prev, channel: e.target.value }))}
                        disabled={createSaving}
                      >
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="OTHER">Outro</option>
                      </select>
                    </div>
                  )}
                </div>

                {isWaha && (
                  <div className="rounded-xl p-4 border border-white/10 bg-[#0B1324] text-sm text-white/70">
                    A sessao WAHA sera criada automaticamente ao salvar. Abra a caixa na lista para
                    gerar o QR Code e concluir o pareamento com seu WhatsApp.
                  </div>
                )}



                {/* BLOCO ESPECIFICO: META */}
                {isMeta && (
                  <div className="rounded-xl p-4 border border-white/10 bg-[#0B1324]">
                    <div className="text-sm font-medium config-heading mb-3">Configuracoes Meta</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className={LABEL}>Access Token</label>
                        <input
                          className={INPUT_BASE}
                          value={createInboxForm.provider_config?.meta?.access_token ?? ""}
                          onChange={(e) =>
                            setCreateInboxForm((prev) => ({
                              ...prev,
                              provider_config: {
                                ...(prev.provider_config || {}),
                                meta: { ...(prev.provider_config?.meta || {}), access_token: e.target.value },
                              },
                            }))
                          }
                          placeholder="EAAG..."
                          disabled={createSaving}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Phone Number ID</label>
                        <input
                          className={INPUT_BASE}
                          value={createInboxForm.provider_config?.meta?.phone_number_id ?? ""}
                          onChange={(e) =>
                            setCreateInboxForm((prev) => ({
                              ...prev,
                              provider_config: {
                                ...(prev.provider_config || {}),
                                meta: { ...(prev.provider_config?.meta || {}), phone_number_id: e.target.value },
                              },
                            }))
                          }
                          placeholder="Ex: 123456789000"
                          disabled={createSaving}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>WABA ID</label>
                        <input
                          className={INPUT_BASE}
                          value={createInboxForm.provider_config?.meta?.waba_id ?? ""}
                          onChange={(e) =>
                            setCreateInboxForm((prev) => ({
                              ...prev,
                              provider_config: {
                                ...(prev.provider_config || {}),
                                meta: { ...(prev.provider_config?.meta || {}), waba_id: e.target.value },
                              },
                            }))
                          }
                          placeholder="Ex: 10203040506070"
                          disabled={createSaving}
                        />
                      </div>
                      <div>
                        <label className={LABEL}>Webhook Verify Token</label>
                        <div className="flex gap-2">
                          <input
                            className={INPUT_BASE + " flex-1"}
                            value={createInboxForm.provider_config?.meta?.webhook_verify_token ?? ""}
                            onChange={(e) =>
                              setCreateInboxForm((prev) => ({
                                ...prev,
                                provider_config: {
                                  ...(prev.provider_config || {}),
                                  meta: { ...(prev.provider_config?.meta || {}), webhook_verify_token: e.target.value },
                                },
                              }))
                            }
                            placeholder="token seguro para assinatura"
                            disabled={createSaving}
                          />
                          <button
                            type="button"
                            className={SOFT_BTN}
                            onClick={() =>
                              setCreateInboxForm((prev) => ({
                                ...prev,
                                provider_config: {
                                  ...(prev.provider_config || {}),
                                  meta: { ...(prev.provider_config?.meta || {}), webhook_verify_token: generateVerifyToken() },
                                },
                              }))
                            }
                            disabled={createSaving}
                          >
                            Gerar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <label className="inline-flex items-center gap-2 text-sm config-text-muted">
                  <input
                    type="checkbox"
                    checked={createInboxForm.is_active}
                    onChange={(e) => setCreateInboxForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                    disabled={createSaving}
                  />
                  Ativa
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button 
                  className="px-6 py-2.5 rounded-xl text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 transition font-medium" 
                  onClick={closeCreateModal} 
                  disabled={createSaving}
                >
                  Cancelar
                </button>
                <button 
                  className="px-6 py-2.5 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold transition shadow-lg disabled:opacity-50" 
                  onClick={submitCreateInbox} 
                  disabled={createSaving}
                >
                  {createSaving ? "Salvando..." : "Criar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EXCLUIR */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-gray-300 dark:border-gray-700 bg-linear-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 shadow-md transition-colors duration-300">
            <div className="p-8">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-600/20 flex items-center justify-center transition-colors duration-300">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  Excluir caixa de entrada
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Confirmar exclusão da caixa "{deleteTarget.name || deleteTarget.phone_number}"?
                </p>
              </div>
              <div className="flex justify-end gap-3">
                <button 
                  className="px-6 py-2.5 rounded-xl text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 transition font-medium" 
                  onClick={closeDeleteModal} 
                  disabled={deleteSaving}
                >
                  Cancelar
                </button>
                <button
                  className="px-6 py-2.5 rounded-xl bg-linear-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold transition shadow-lg disabled:opacity-50"
                  onClick={confirmDeleteInbox}
                  disabled={deleteSaving}
                >
                  {deleteSaving ? "Excluindo..." : "Sim, excluir"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



































