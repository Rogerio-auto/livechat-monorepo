import { randomUUID } from "crypto";

export const WAHA_PROVIDER = "WAHA";
export const WAHA_BASE_URL = (process.env.WAHA_BASE_URL || "https://waha.7sion.com").replace(/\/+$/, "");
export const WAHA_API_KEY = process.env.WAHA_API_KEY || "";

export class WahaHttpError extends Error {
  status: number;
  body?: string;

  constructor(status: number, message: string, body?: string) {
    super(message || `WAHA HTTP ${status}`);
    this.name = "WahaHttpError";
    this.status = status;
    this.body = body;
  }
}

type HeadersInput = Headers | Array<[string, string]> | Record<string, string> | undefined;

function headersToObject(input: HeadersInput): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!input) return headers;

  if (input instanceof Headers) {
    input.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  if (Array.isArray(input)) {
    for (const [key, value] of input) {
      headers[key] = value;
    }
    return headers;
  }

  return { ...input };
}

export async function wahaFetch<T = any>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${WAHA_BASE_URL}${path}`;
  const headers = headersToObject(opts?.headers);

  const hasBody = opts?.body !== undefined && opts.body !== null;
  const isFormData =
    typeof FormData !== "undefined" && hasBody && (opts!.body as any) instanceof FormData;

  if (hasBody && !isFormData && !headers["content-type"] && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (WAHA_API_KEY) {
    headers["X-Api-Key"] = headers["X-Api-Key"] || headers["x-api-key"] || WAHA_API_KEY;
    if (!headers["Authorization"] && !headers["authorization"]) {
      headers["Authorization"] = `Bearer ${WAHA_API_KEY}`;
    }
  }

  const response = await fetch(url, {
    ...opts,
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new WahaHttpError(response.status, text || response.statusText || "WAHA request failed", text);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json") || contentType.includes("+json")) {
    return (await response.json()) as T;
  }

  if (contentType.startsWith("text/")) {
    return (await response.text()) as unknown as T;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) {
    return {} as T;
  }
  return {
    base64: `data:${contentType || "application/octet-stream"};base64,${buffer.toString("base64")}`,
  } as unknown as T;
}

export async function ensureWahaSession(sessionName: string, opts?: { start?: boolean; config?: any; webhooks?: any }) {
  console.log("[ensureWahaSession] 🎬 Iniciando criação/atualização de sessão WAHA:", sessionName);
  console.log("[ensureWahaSession] ⚙️ Opções:", opts);
  
  const payload: Record<string, unknown> = { name: sessionName };
  if (opts?.config) payload.config = opts.config;
  if (opts?.webhooks) payload.webhooks = opts.webhooks;

  console.log("[ensureWahaSession] 📦 Payload para criação:", payload);

  try {
    console.log("[ensureWahaSession] 📡 POST /api/sessions");
    await wahaFetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("[ensureWahaSession] ✅ Sessão criada com sucesso");
  } catch (error) {
    if (error instanceof WahaHttpError && (error.status === 409 || error.status === 422)) {
      console.log("[ensureWahaSession] ⚠️ Sessão já existe (status " + error.status + "), tentando atualizar...");
      try {
        console.log("[ensureWahaSession] 📡 PUT /api/sessions/" + sessionName);
        await wahaFetch(`/api/sessions/${encodeURIComponent(sessionName)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        console.log("[ensureWahaSession] ✅ Sessão atualizada com sucesso");
      } catch (e) {
        if (!(e instanceof WahaHttpError) || (e.status !== 409 && e.status !== 422)) {
          console.error("[ensureWahaSession] ❌ Erro ao atualizar sessão:", e);
          throw e;
        }
        console.log("[ensureWahaSession] ✅ Sessão já existe, continuando...");
      }
    } else {
      console.error("[ensureWahaSession] ❌ Erro ao criar sessão:", error);
      throw error;
    }
  }

  if (opts?.start) {
    console.log("[ensureWahaSession] 🚀 Iniciando sessão WAHA...");
    try {
      console.log("[ensureWahaSession] 📡 POST /api/sessions/" + sessionName + "/start");
      await wahaFetch(`/api/sessions/${encodeURIComponent(sessionName)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      console.log("[ensureWahaSession] ✅ Sessão iniciada com sucesso");
    } catch (error) {
      if (!(error instanceof WahaHttpError) || (error.status !== 409 && error.status !== 423 && error.status !== 422)) {
        console.error("[ensureWahaSession] ❌ Erro ao iniciar sessão:", error);
        throw error;
      }
      console.log("[ensureWahaSession] ✅ Sessão já está em execução");
    }
  }
  
  console.log("[ensureWahaSession] 🎉 Processo concluído com sucesso");
}

export async function fetchWahaSession(sessionName: string): Promise<any> {
  return wahaFetch(`/api/sessions/${encodeURIComponent(sessionName)}`);
}

export async function requestWahaQr(sessionName: string, format: "raw" | "image" | "json" = "image"): Promise<any> {
  const suffix =
    format === "raw" ? "?format=raw" : format === "image" ? "" : "?format=json";
  return wahaFetch(`/api/${encodeURIComponent(sessionName)}/auth/qr${suffix}`, {
    headers:
      format === "image"
        ? { Accept: "image/png" }
        : { Accept: "application/json" },
  });
}

export function buildWahaSessionId(name: string, companyId: string, randomSuffix?: string) {
  const normalizedName = name.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "") || "WAHA";
  // Usar apenas últimos 8 caracteres do company_id para evitar exceder limite de 54 chars
  const normalizedCompany = (companyId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "COMPANY").slice(-8);
  const suffix = (randomSuffix || randomUUID()).split("-")[0].toUpperCase();
  const sessionId = `${normalizedName}_${normalizedCompany}_${suffix}`;
  
  console.log("[buildWahaSessionId] 🔑 Gerado:", sessionId, "| Tamanho:", sessionId.length, "| Limite: 54");
  
  if (sessionId.length > 54) {
    console.warn("[buildWahaSessionId] ⚠️ Session ID muito longo! Truncando...");
    return sessionId.slice(0, 54);
  }
  
  return sessionId;
}

export async function fetchWahaChatDetails(
  sessionName: string,
  remoteChatId: string,
  apiKey?: string,
): Promise<any> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
    headers["X-Api-Key"] = apiKey;
  }
  const encodedSession = encodeURIComponent(sessionName);
  const encodedChat = encodeURIComponent(remoteChatId);
  
  // Groups end with @g.us and need the /groups/ endpoint instead of /chats/
  const isGroup = remoteChatId.endsWith('@g.us');
  const endpoint = isGroup ? 'groups' : 'chats';
  
  return wahaFetch(`/api/${encodedSession}/${endpoint}/${encodedChat}`, { headers });
}

export async function fetchWahaChatPicture(
  sessionName: string,
  remoteChatId: string,
  opts?: { refresh?: boolean },
): Promise<{ url: string | null }> {
  const encodedSession = encodeURIComponent(sessionName);
  const encodedChat = encodeURIComponent(remoteChatId);
  const refresh = opts?.refresh ? "?refresh=true" : "";
  const url = `/api/${encodedSession}/chats/${encodedChat}/picture${refresh}`;
  console.debug("[WAHA][fetchWahaChatPicture] calling", { sessionName, remoteChatId, url });
  try {
    const result = await wahaFetch<{ profilePictureURL?: string | null }>(url);
    const pictureUrl = result?.profilePictureURL || null;
    console.debug("[WAHA][fetchWahaChatPicture] response", { 
      remoteChatId, 
      hasUrl: !!pictureUrl, 
      url: pictureUrl 
    });
    return { url: pictureUrl };
  } catch (error) {
    const err = error as any;
    console.warn("[WAHA][fetchWahaChatPicture] error", { 
      remoteChatId, 
      message: err?.message, 
      status: err?.status,
      statusText: err?.statusText,
      body: err?.body,
      fullError: error 
    });
    return { url: null };
  }
}

export async function fetchWahaGroupPicture(
  sessionName: string,
  groupId: string,
  opts?: { refresh?: boolean },
): Promise<{ url: string | null }> {
  const encodedSession = encodeURIComponent(sessionName);
  const encodedGroup = encodeURIComponent(groupId);
  const refresh = opts?.refresh ? "?refresh=true" : "";
  const url = `/api/${encodedSession}/groups/${encodedGroup}/picture${refresh}`;
  console.debug("[WAHA][fetchWahaGroupPicture] calling", { sessionName, groupId, url });
  try {
    const result = await wahaFetch<{ url?: string | null; profilePictureURL?: string | null }>(url);
    const pictureUrl = (result?.url || result?.profilePictureURL) ?? null;
    console.debug("[WAHA][fetchWahaGroupPicture] response", { groupId, hasUrl: !!pictureUrl, url: pictureUrl });
    return { url: pictureUrl };
  } catch (error) {
    const err = error as any;
    console.warn("[WAHA][fetchWahaGroupPicture] error", {
      groupId,
      message: err?.message,
      status: err?.status,
      statusText: err?.statusText,
      body: err?.body,
      fullError: error,
    });
    return { url: null };
  }
}

export async function deleteWahaMessage(
  sessionName: string,
  remoteChatId: string,
  messageId: string,
): Promise<{ ok: boolean }> {
  const encodedSession = encodeURIComponent(sessionName);
  const encodedChat = encodeURIComponent(remoteChatId);
  const encodedMsg = encodeURIComponent(messageId);
  const url = `/api/${encodedSession}/chats/${encodedChat}/messages/${encodedMsg}`;
  console.debug("[WAHA][deleteWahaMessage] calling", { sessionName, remoteChatId, messageId, url });
  await wahaFetch(url, { method: "DELETE" });
  return { ok: true };
}

export async function editWahaMessage(
  sessionName: string,
  remoteChatId: string,
  messageId: string,
  body: { text: string; linkPreview?: boolean; linkPreviewHighQuality?: boolean },
): Promise<{ ok: boolean }> {
  const encodedSession = encodeURIComponent(sessionName);
  const encodedChat = encodeURIComponent(remoteChatId);
  const encodedMsg = encodeURIComponent(messageId);
  const url = `/api/${encodedSession}/chats/${encodedChat}/messages/${encodedMsg}`;
  console.debug("[WAHA][editWahaMessage] calling", { sessionName, remoteChatId, messageId, body, url });
  await wahaFetch(url, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: true };
}

export async function fetchWahaContactPicture(
  sessionName: string,
  contactId: string,
  opts?: { refresh?: boolean },
): Promise<{ url: string | null }> {
  const params = new URLSearchParams({
    contactId,
    session: sessionName,
  });
  if (opts?.refresh) params.set("refresh", "true");
  const url = `/api/contacts/profile-picture?${params.toString()}`;
  console.debug("[WAHA][fetchWahaContactPicture] calling", { sessionName, contactId, url });
  try {
    const result = await wahaFetch<{ profilePictureURL?: string | null }>(url);
    const pictureUrl = result?.profilePictureURL || null;
    console.debug("[WAHA][fetchWahaContactPicture] response", { 
      contactId, 
      hasUrl: !!pictureUrl, 
      url: pictureUrl
    });
    return { url: pictureUrl };
  } catch (error) {
    const err = error as any;
    console.warn("[WAHA][fetchWahaContactPicture] error", { 
      contactId, 
      message: err?.message, 
      status: err?.status,
      statusText: err?.statusText,
      body: err?.body,
      fullError: error 
    });
    return { url: null };
  }
}
