// utils/api.ts
export const API =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ||
  "http://localhost:5000";

/**
 * Recupera o access_token do Supabase procurando a chave real no localStorage.
 * Compatível com diferentes formatos:
 * - { access_token }
 * - { currentSession: { access_token } }
 * - { data: { session: { access_token } } }  (fallback extra)
 */
export function getAccessToken(): string | undefined {
  // ache a chave certa: sb-<project-ref>-auth-token
  let key: string | undefined;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i) || "";
    if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
      key = k;
      break;
    }
  }
  if (!key) return;

  const raw = localStorage.getItem(key);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);

    // formatos possíveis
    if (typeof parsed?.access_token === "string") {
      return parsed.access_token;
    }
    if (typeof parsed?.currentSession?.access_token === "string") {
      return parsed.currentSession.access_token;
    }
    if (typeof parsed?.data?.session?.access_token === "string") {
      return parsed.data.session.access_token;
    }

    // último recurso: procurar em profundidade
    const maybe = deepFindAccessToken(parsed);
    if (typeof maybe === "string") return maybe;

    return;
  } catch {
    return;
  }
}

/** Busca recursiva por uma propriedade 'access_token' string */
function deepFindAccessToken(obj: any): string | undefined {
  if (!obj || typeof obj !== "object") return;
  for (const [k, v] of Object.entries(obj)) {
    if (k === "access_token" && typeof v === "string") return v;
    if (v && typeof v === "object") {
      const found = deepFindAccessToken(v);
      if (found) return found;
    }
  }
  return;
}

export async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getAccessToken();

  const headers = new Headers(init.headers || {});
  if (!headers.has("Content-Type") && init.body) headers.set("Content-Type", "application/json");
  if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

  // (opcional) dev shortcut: mandar company-id no header pra testes locais
  const devCompany = import.meta.env.VITE_DEV_COMPANY_ID as string | undefined;
  if (import.meta.env.DEV && devCompany && !headers.has("X-Company-Id")) {
    headers.set("X-Company-Id", devCompany);
  }

  const res = await fetch(url, { ...init, headers, credentials: "include" });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || res.statusText || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data as T;
}
