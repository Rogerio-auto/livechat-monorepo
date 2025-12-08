import type { Request, Response, NextFunction } from "express";
import type { PostgrestError } from "@supabase/supabase-js";
import { supabaseAdmin } from "../lib/supabase.ts";
import { JWT_COOKIE_NAME } from "../config/env.ts";
import { rGet, rSet } from "../lib/redis.ts";

const isDev = process.env.NODE_ENV !== "production";
const AUTH_CACHE_TTL = 300; // 5 minutos

type UserCompanyRow = {
  company_id?: string | null;
  email?: string | null;
  role?: string | null;
};

function isIgnorableLookupError(error: PostgrestError | null, column: string): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  if (code === "42703" /* undefined_column */ || code === "42P01" /* undefined_table */) {
    return true;
  }
  const message = String(error.message || "").toLowerCase();
  if (message.includes("column") && message.includes(column.toLowerCase())) return true;
  if (message.includes("relation") && message.includes("users")) return true;
  return false;
}

function isMissingColumn(error: PostgrestError | null, column: string): boolean {
  if (!error) return false;
  const code = String(error.code || "");
  if (code === "42703") return true;
  const message = String(error.message || "").toLowerCase();
  return message.includes("column") && message.includes(column.toLowerCase());
}

async function selectUserRow(column: string, userId: string, includeEmail: boolean) {
  const selectColumns = includeEmail ? "company_id, email, role" : "company_id, role";
  return supabaseAdmin
    .from("users")
    .select(selectColumns)
    .eq(column, userId)
    .maybeSingle();
}

async function resolveUserCompany(userId: string): Promise<{ row: UserCompanyRow | null; error: PostgrestError | null }> {
  const lookupColumns = ["user_id", "id", "auth_user_id"];

  for (const column of lookupColumns) {
    const { data, error } = await selectUserRow(column, userId, true);

    if (error) {
      if (isMissingColumn(error, "email")) {
        const { data: fallbackData, error: fallbackError } = await selectUserRow(column, userId, false);
        if (fallbackError) {
          if (isIgnorableLookupError(fallbackError, column)) continue;
          return { row: null, error: fallbackError };
        }
        if (fallbackData) {
          return { row: fallbackData as UserCompanyRow, error: null };
        }
        continue;
      }
      if (isIgnorableLookupError(error, column)) {
        continue;
      }
      return { row: null, error };
    }

    if (data) {
      return { row: data as UserCompanyRow, error: null };
    }
  }

  return { row: null, error: null };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // DEV backdoor opcional (usar DEV_COMPANY_ID ou header)
    if (isDev) {
      const devCompany = (req.header("x-company-id") || process.env.DEV_COMPANY_ID || "").trim();
      if (devCompany) {
        (req as any).user = {
          id: "dev",
          email: "dev@local",
          company_id: devCompany,
        };
        return next();
      }
    }

    const bearer = (req.headers.authorization ?? "") as string;
    let token = bearer.startsWith("Bearer ") ? bearer.slice(7) : undefined;
    
    // Se o token do header for "undefined" (string), ignorar
    if (token === "undefined") token = undefined;
    
    if (!token) token = (req as any).cookies?.[JWT_COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "Not authenticated" });

    // ✅ Cache de autenticação por token hash
    const tokenHash = Buffer.from(token).toString("base64").slice(0, 32);
    const cacheKey = `auth:token:${tokenHash}`;
    
    try {
      const cached = await rGet(cacheKey);
      if (cached) {
        const authData = JSON.parse(cached);
        (req as any).user = authData.user;
        (req as any).profile = authData.profile;
        console.log("[requireAuth] 🚀 Cache HIT:", { userId: authData.user.id });
        return next();
      }
    } catch (cacheError) {
      console.warn("[requireAuth] Cache read error:", cacheError);
    }

    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) return res.status(401).json({ error: "Invalid token" });
    const supaUser = data.user;

    const { row: profile, error: profileError } = await resolveUserCompany(supaUser.id);
    if (profileError && isDev) {
      console.error("[requireAuth] profile lookup failed:", profileError.message);
    }

    const meta = (supaUser.user_metadata ?? {}) as Record<string, unknown>;
    const appMeta = (supaUser.app_metadata ?? {}) as Record<string, unknown>;

    const metaCompany =
      (typeof meta.company_id === "string" && meta.company_id.trim()) ||
      (typeof meta.companyId === "string" && meta.companyId.trim()) ||
      null;
    const appMetaCompany =
      (typeof appMeta.company_id === "string" && appMeta.company_id.trim()) ||
      (typeof appMeta.companyId === "string" && appMeta.companyId.trim()) ||
      null;

    let companyId =
      profile?.company_id?.toString().trim() ||
      (typeof (supaUser as any).company_id === "string" ? (supaUser as any).company_id.trim() : null) ||
      metaCompany ||
      appMetaCompany ||
      null;

    if (!companyId) {
      const headerCompany = (req.header("x-company-id") || req.header("X-Company-Id") || "").trim();
      if (headerCompany) companyId = headerCompany;
    }

    if (!companyId) {
      return res.status(400).json({ error: "Missing company context" });
    }

    // Buscar o ID da tabela public.users + theme_preference + phone
    let publicUserId: string | null = null;
    let themePreference: string = "system";
    let phone: string | null = null;
    try {
      const { data: publicUser, error: publicUserError } = await supabaseAdmin
        .from("users")
        .select("id, theme_preference, phone")
        .eq("user_id", supaUser.id)
        .maybeSingle();
      
      if (publicUserError) {
        console.error("[requireAuth] Error fetching public user data:", publicUserError);
      }
      
      if (publicUser?.id) {
        publicUserId = publicUser.id;
        themePreference = publicUser.theme_preference || "system";
        phone = publicUser.phone || null;
      } else {
        console.warn("[requireAuth] No public user found for auth user:", supaUser.id);
      }
    } catch (error) {
      console.error("[requireAuth] Exception fetching public user data:", error);
    }

    (req as any).user = {
      id: supaUser.id, // ID do Supabase Auth (mantido para compatibilidade)
      public_user_id: publicUserId, // ID da tabela public.users
      email:
        profile?.email ??
        (typeof meta.email === "string" ? meta.email : undefined) ??
        (typeof appMeta.email === "string" ? appMeta.email : undefined) ??
        supaUser.email,
      company_id: companyId ?? null,
      phone: phone, // ✅ Telefone do usuário
    };
    
    // Adicionar profile com role para rotas admin
    (req as any).profile = {
      id: supaUser.id,
      email:
        profile?.email ??
        (typeof meta.email === "string" ? meta.email : undefined) ??
        (typeof appMeta.email === "string" ? appMeta.email : undefined) ??
        supaUser.email,
      company_id: companyId ?? null,
      role: profile?.role ?? "USER", // Default USER se não encontrar
      theme_preference: themePreference, // ✅ Incluir theme no profile
      phone: phone, // ✅ Telefone do usuário
    };
    
    console.log("[requireAuth] 🔑 User authenticated:", {
      authUserId: supaUser.id,
      publicUserId,
      email: (req as any).user.email,
      company_id: companyId,
      role: profile?.role,
    });
    
    // ✅ Salvar no cache por 5 minutos
    try {
      await rSet(
        cacheKey,
        JSON.stringify({
          user: (req as any).user,
          profile: (req as any).profile,
        }),
        AUTH_CACHE_TTL
      );
    } catch (cacheError) {
      console.warn("[requireAuth] Cache write error:", cacheError);
    }
    
    next();
  } catch (e: any) {
    if (isDev) console.error("[requireAuth] fatal:", e?.message);
    res.status(500).json({ error: "Auth middleware failed" });
  }
}
