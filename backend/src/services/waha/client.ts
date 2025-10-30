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
  const payload: Record<string, unknown> = { name: sessionName };
  if (opts?.config) payload.config = opts.config;
  if (opts?.webhooks) payload.webhooks = opts.webhooks;

  try {
    await wahaFetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof WahaHttpError && (error.status === 409 || error.status === 422)) {
      try {
        await wahaFetch(`/api/sessions/${encodeURIComponent(sessionName)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        if (!(e instanceof WahaHttpError) || (e.status !== 409 && e.status !== 422)) {
          throw e;
        }
      }
    } else {
      throw error;
    }
  }

  if (opts?.start) {
    try {
      await wahaFetch(`/api/sessions/${encodeURIComponent(sessionName)}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      if (!(error instanceof WahaHttpError) || (error.status !== 409 && error.status !== 423 && error.status !== 422)) {
        throw error;
      }
    }
  }
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
  const normalizedCompany = companyId.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") || "COMPANY";
  const suffix = (randomSuffix || randomUUID()).split("-")[0].toUpperCase();
  return `${normalizedName}_${normalizedCompany}_${suffix}`;
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
  return wahaFetch(`/api/${encodedSession}/chats/${encodedChat}`, { headers });
}

export async function fetchWahaChatPicture(
  sessionName: string,
  remoteChatId: string,
  opts?: { refresh?: boolean },
): Promise<{ url: string | null }> {
  const encodedSession = encodeURIComponent(sessionName);
  const encodedChat = encodeURIComponent(remoteChatId);
  const refresh = opts?.refresh ? "?refresh=true" : "";
  return wahaFetch<{ url: string | null }>(`/api/${encodedSession}/chats/${encodedChat}/picture${refresh}`);
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
  return wahaFetch<{ url: string | null }>(`/api/contacts/profile-picture?${params.toString()}`);
}
