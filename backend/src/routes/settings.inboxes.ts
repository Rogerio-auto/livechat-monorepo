import type { Application } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { checkResourceLimit } from "../middlewares/checkSubscription.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { logger } from "../lib/logger.ts";
import { getIO } from "../lib/io.ts";
import { decryptSecret, encryptSecret, isEncryptedSecret } from "../lib/crypto.ts";
import type { PostgrestError } from "@supabase/supabase-js";
import {
  buildWahaSessionId,
  ensureWahaSession,
} from "../services/waha/client.ts";

type ActorContext = {
  companyId: string;
  localUserId: string | null;
  role: string | null;
};

type InboxSecretRow = {
  inbox_id: string;
  access_token: string | null;
  refresh_token: string | null;
  provider_api_key: string | null;
};

const INBOX_SELECT =
  "id, name, phone_number, is_active, webhook_url, channel, provider, base_url, api_version, phone_number_id, waba_id, instance_id, webhook_verify_token, app_secret, created_at, updated_at, company_id, waha_db_name";

const META_PROVIDER = "META_CLOUD";
const WAHA_PROVIDER = "WAHA";

const safeConfigField = z.preprocess((val) => {
  if (typeof val === "string" && val.trim() === "") return null;
  return val;
}, z.string().nullable().optional());

const metaConfigSchema = z
  .object({
    access_token: safeConfigField,
    phone_number_id: safeConfigField,
    waba_id: safeConfigField,
    webhook_verify_token: safeConfigField,
    app_secret: safeConfigField,
    refresh_token: safeConfigField,
    provider_api_key: safeConfigField,
  });

const wahaConfigSchema = z
  .object({
    api_key: safeConfigField,
  });

const optionalUrl = z.preprocess((val) => {
  if (!val || typeof val !== "string" || val.trim() === "") return null;
  const s = val.trim();
  // Se não tem protocolo, mas parece uma URL/IP, adiciona http://
  if (!/^https?:\/\//i.test(s)) {
    return `http://${s}`;
  }
  return s;
}, z.string().url().nullable());

const inboxCreateSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório"),
    phone_number: z.string().min(5, "Número de telefone inválido ou muito curto"),
    webhook_url: optionalUrl.optional(),
    channel: z.string().optional(),
    provider: z.string().optional(),
    is_active: z.boolean().optional(),
    base_url: optionalUrl.optional(),
    api_version: z.string().optional().nullable(),
    instance_id: z.string().optional().nullable(),
    provider_config: z
      .object({
        meta: metaConfigSchema.optional(),
        waha: wahaConfigSchema.optional(),
      })
      .optional(),
    add_current_as_manager: z.boolean().optional().default(true),
  })
  .strip();

const inboxUpdateSchema = inboxCreateSchema.partial({
  name: true,
  phone_number: true,
  add_current_as_manager: true,
}).refine((payload) => Object.keys(payload).length > 0, {
  message: "Nada para atualizar",
});

async function fetchActorContext(req: any): Promise<ActorContext> {
  const authId = String(req?.user?.id || "");
  if (!authId) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  const lookupColumns: Array<string> = ["user_id", "id", "auth_user_id"];
  const isIgnorableError = (error: PostgrestError | null, column: string) => {
    if (!error) return false;
    const code = String(error.code || "");
    if (code === "42703" || code === "42P01") return true;
    const message = String(error.message || "").toLowerCase();
    if (message.includes("column") && message.includes(column.toLowerCase())) return true;
    if (message.includes("relation") && message.includes("users")) return true;
    return false;
  };

  let companyId =
    (req?.user?.company_id as string | undefined | null)?.toString().trim() || null;
  let localUserId: string | null = null;
  let role: string | null = null;

  for (const column of lookupColumns) {
    try {
      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, company_id, role")
        .eq(column, authId)
        .maybeSingle();

      if (error) {
        if (isIgnorableError(error, column)) continue;
        throw error;
      }

      if (data) {
        localUserId = (data.id as string | undefined) || localUserId;
        role = (data.role as string | undefined | null) ?? role;
        const rowCompany = (data.company_id as string | undefined | null)?.toString().trim();
        if (rowCompany) {
          companyId = rowCompany;
        }
        break;
      }
    } catch (err) {
      const error = err as PostgrestError | undefined;
      if (error && isIgnorableError(error, column)) continue;
      throw Object.assign(
        new Error(error?.message || "Failed to load actor context"),
        { status: 500 },
      );
    }
  }

  if (!companyId) {
    throw Object.assign(new Error("Usuario sem company_id"), { status: 404 });
  }

  return {
    companyId,
    localUserId,
    role,
  };
}

function buildProviderConfig(row: any, secret?: InboxSecretRow | null) {
  const provider = (row?.provider || "").toUpperCase();
  if (provider === META_PROVIDER) {
    const meta: Record<string, string | null> = {
      access_token: decryptSecret(secret?.access_token),
      phone_number_id: row?.phone_number_id ?? null,
      waba_id: row?.waba_id ?? null,
      webhook_verify_token: row?.webhook_verify_token ?? null,
      app_secret: row?.app_secret ?? null,
    };
    if (secret?.refresh_token !== undefined) {
      meta.refresh_token = decryptSecret(secret?.refresh_token);
    }
    if (secret?.provider_api_key !== undefined) {
      meta.provider_api_key = decryptSecret(secret?.provider_api_key);
    }
    return { meta };
  }
  if (provider === WAHA_PROVIDER) {
    return {
      waha: {
        api_key: decryptSecret(secret?.provider_api_key),
      },
    };
  }
  return undefined;
}

function mapInbox(row: any, secret?: InboxSecretRow | null) {
  return {
    ...row,
    provider_config: buildProviderConfig(row, secret ?? null),
  };
}

function resolveMetaWebhookUrl(req: any): string | null {
  const envUrl = process.env.META_WEBHOOK_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim()) {
    return envUrl.trim();
  }
  const forwardedProto = (req?.get?.("x-forwarded-proto") || "").toString().split(",")[0].trim();
  const proto = forwardedProto || req?.protocol || "http";
  const host =
    req?.get?.("x-forwarded-host")?.toString().split(",")?.[0]?.trim() ||
    req?.get?.("host") ||
    null;
  if (!host) return null;
  const normalizedHost = host.replace(/\/+$/, "");
  return `${proto}://${normalizedHost}/integrations/meta/webhook`;
}

async function loadInboxWithSecret(id: string): Promise<any> {
  const { data, error } = await supabaseAdmin
    .from("inboxes")
    .select(INBOX_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw Object.assign(new Error(error.message), { status: 500 });
  if (!data) throw Object.assign(new Error("Inbox nao encontrada"), { status: 404 });

  const { data: secret, error: secretErr } = await supabaseAdmin
    .from("inbox_secrets")
    .select("inbox_id, access_token, refresh_token, provider_api_key")
    .eq("inbox_id", id)
    .maybeSingle();
  if (secretErr) throw Object.assign(new Error(secretErr.message), { status: 500 });

  return mapInbox(data, secret as InboxSecretRow | null);
}

async function ensureManagePermission(
  inboxId: string,
  ctx: ActorContext,
): Promise<{ inbox: any; allowed: boolean }> {
  const { data: inbox, error } = await supabaseAdmin
    .from("inboxes")
    .select("id, company_id")
    .eq("id", inboxId)
    .maybeSingle();
  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!inbox) {
    throw Object.assign(new Error("Inbox nao encontrada"), { status: 404 });
  }
  if ((inbox as any).company_id !== ctx.companyId) {
    throw Object.assign(new Error("Sem acesso a esta inbox"), { status: 403 });
  }

  let allowed = false;
  const role = (ctx.role || "").toUpperCase();
  if (role && role !== "AGENT") {
    allowed = true;
  }
  if (!allowed && ctx.localUserId) {
    const { data: link } = await supabaseAdmin
      .from("inbox_users")
      .select("can_manage")
      .eq("inbox_id", inboxId)
      .eq("user_id", ctx.localUserId)
      .maybeSingle();
    if (link?.can_manage) {
      allowed = true;
    }
  }
  if (!allowed) {
    throw Object.assign(new Error("Sem permissao para editar esta inbox"), {
      status: 403,
    });
  }
  return { inbox, allowed };
}

function extractMeta(
  provider: string | undefined,
  providerConfig: any | undefined,
) {
  if ((provider || META_PROVIDER).toUpperCase() !== META_PROVIDER) {
    return null;
  }
  return providerConfig?.meta ?? null;
}

function extractWaha(provider: string | undefined, providerConfig: any | undefined) {
  if ((provider || "").toUpperCase() !== WAHA_PROVIDER) return null;
  return providerConfig?.waha ?? null;
}

function normalizeString(value: any) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function prepareSecretForStorage(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (isEncryptedSecret(value)) return value;
  return encryptSecret(value);
}

export function registerSettingsInboxesRoutes(app: Application) {
  app.get("/settings/inboxes", requireAuth, async (req: any, res) => {
    try {
      const { companyId } = await fetchActorContext(req);
      const { data, error } = await supabaseAdmin
        .from("inboxes")
        .select(INBOX_SELECT)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) return res.status(500).json({ error: error.message });

      const rows = data ?? [];
      if (rows.length === 0) return res.json([]);

      const { data: secrets } = await supabaseAdmin
        .from("inbox_secrets")
        .select("inbox_id, access_token, refresh_token, provider_api_key")
        .in(
          "inbox_id",
          rows.map((row) => row.id),
        );
      const secretMap = new Map<string, InboxSecretRow>();
      (secrets || []).forEach((secret) => {
        secretMap.set(secret.inbox_id, secret as InboxSecretRow);
      });

      return res.json(rows.map((row) => mapInbox(row, secretMap.get(row.id) ?? null)));
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "settings inboxes list error";
      if (status >= 500) {
        console.error("[settings.inboxes] list error:", message, e?.stack || e);
      }
      return res.status(status).json({ error: message });
    }
  });

  app.post("/settings/inboxes", requireAuth, checkResourceLimit("inboxes"), async (req: any, res) => {
    try {
      logger.info("[POST /settings/inboxes] 🎬 Iniciando criação de inbox");
      logger.info("[POST /settings/inboxes] 📦 Body recebido:", req.body);
      
      const ctx = await fetchActorContext(req);
      logger.info("[POST /settings/inboxes] 👤 Contexto do usuário:", {
        userId: ctx.localUserId,
        companyId: ctx.companyId,
        role: ctx.role
      });
      
      const parsed = inboxCreateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        const errorDetails = parsed.error.format();
        console.error("[POST /settings/inboxes] ❌ Validação falhou:", errorDetails);
        
        // Pegar a primeira mensagem de erro amigável de forma segura
        const issues = parsed.error.issues || [];
        const firstError = issues[0]?.message || "Dados inválidos";
        
        return res
          .status(400)
          .json({ 
            error: `Dados inválidos: ${firstError}`, 
            details: errorDetails 
          });
      }
      const body = parsed.data;
      const provider = (body.provider || META_PROVIDER).toUpperCase();
      console.log("[POST /settings/inboxes] 🔌 Provider:", provider);
      
      const meta = extractMeta(provider, body.provider_config);
      const waha = extractWaha(provider, body.provider_config);
      const resolvedMetaWebhook = provider === META_PROVIDER ? resolveMetaWebhookUrl(req) : null;

      if (provider === META_PROVIDER) {
        if (
          !meta?.access_token ||
          !meta.phone_number_id ||
          !meta.waba_id ||
          !meta.webhook_verify_token
        ) {
          console.error("[POST /settings/inboxes] ❌ Campos Meta obrigatórios ausentes");
          return res.status(400).json({
            error:
              "Campos obrigatorios da Meta ausentes (access_token, phone_number_id, waba_id, webhook_verify_token)",
          });
        }
      }

      const wahaSessionId =
        provider === WAHA_PROVIDER
          ? (body.instance_id || buildWahaSessionId(body.name, ctx.companyId))
          : null;

      if (wahaSessionId) {
        console.log("[POST /settings/inboxes] 🔑 WAHA Session ID gerado:", wahaSessionId);
      }

      const normalizedPhoneNumber = normalizeString(body.phone_number);
      const fallbackPhoneNumber =
        wahaSessionId ? `PENDING_${wahaSessionId.slice(0, 20)}` : null;

      console.log("[POST /settings/inboxes] 📞 Número de telefone:", {
        original: body.phone_number,
        normalized: normalizedPhoneNumber,
        fallback: fallbackPhoneNumber
      });

      const nowIso = new Date().toISOString();
      const insert: Record<string, any> = {
        name: body.name,
        phone_number:
          provider === WAHA_PROVIDER
            ? normalizedPhoneNumber ?? fallbackPhoneNumber
            : normalizedPhoneNumber ?? body.phone_number,
        webhook_url:
          provider === META_PROVIDER
            ? resolvedMetaWebhook ?? normalizeString(body.webhook_url)
            : normalizeString(body.webhook_url),
        channel: body.channel || "WHATSAPP",
        provider,
        base_url: normalizeString(body.base_url),
        api_version: normalizeString(body.api_version),
        instance_id:
          provider === WAHA_PROVIDER
            ? wahaSessionId
            : normalizeString(body.instance_id),
        is_active: body.is_active ?? true,
        company_id: ctx.companyId,
        created_at: nowIso,
        updated_at: nowIso,
      };

      if (meta) {
        insert.phone_number_id = normalizeString(meta.phone_number_id);
        insert.waba_id = normalizeString(meta.waba_id);
        insert.webhook_verify_token = normalizeString(meta.webhook_verify_token);
        insert.app_secret = normalizeString(meta.app_secret);
      }
      if (provider === WAHA_PROVIDER && wahaSessionId) {
        insert.phone_number_id = wahaSessionId;
      }

      console.log("[POST /settings/inboxes] 💾 Inserindo inbox no banco de dados:", {
        name: insert.name,
        provider: insert.provider,
        phone_number: insert.phone_number,
        instance_id: insert.instance_id,
        company_id: insert.company_id
      });

      const { data: inbox, error } = await supabaseAdmin
        .from("inboxes")
        .insert([insert])
        .select(INBOX_SELECT)
        .single();
      if (error) {
        logger.error("[POST /settings/inboxes] ❌ Erro ao inserir inbox:", error);
        return res.status(500).json({ error: error.message });
      }

      logger.info("[POST /settings/inboxes] ✅ Inbox criada com ID:", inbox.id);

      if (meta) {
        logger.info("[POST /settings/inboxes] 🔐 Salvando secrets da Meta");
        const secretPayload: Record<string, any> = { inbox_id: inbox.id };
        const assignSecret = (
          key: "access_token" | "refresh_token" | "provider_api_key",
          value: string | null | undefined,
        ) => {
          const prepared = prepareSecretForStorage(value);
          if (prepared !== undefined) {
            secretPayload[key] = prepared;
          }
        };
        assignSecret("access_token", meta.access_token);
        assignSecret("refresh_token", meta.refresh_token);
        assignSecret("provider_api_key", meta.provider_api_key);
        await supabaseAdmin
          .from("inbox_secrets")
          .upsert([secretPayload], { onConflict: "inbox_id" });
        logger.info("[POST /settings/inboxes] ✅ Secrets da Meta salvos");
      }
      if (waha?.api_key !== undefined) {
        logger.info("[POST /settings/inboxes] 🔐 Salvando API key da WAHA");
        await supabaseAdmin
          .from("inbox_secrets")
          .upsert(
            [
              {
                inbox_id: inbox.id,
                provider_api_key: prepareSecretForStorage(waha.api_key),
              },
            ],
            { onConflict: "inbox_id" },
          );
        logger.info("[POST /settings/inboxes] ✅ API key da WAHA salva");
      }
      if (resolvedMetaWebhook) {
        console.log("[POST /settings/inboxes] 🔗 Atualizando webhook URL da Meta");
        await supabaseAdmin
          .from("inboxes")
          .update({ webhook_url: resolvedMetaWebhook })
          .eq("id", inbox.id);
      }
      if (provider === WAHA_PROVIDER && wahaSessionId) {
        console.log("[POST /settings/inboxes] 🚀 Garantindo sessão WAHA:", wahaSessionId);
        try {
          await ensureWahaSession(wahaSessionId, { start: true });
          console.log("[POST /settings/inboxes] ✅ Sessão WAHA garantida com sucesso");
        } catch (error: any) {
          console.error("[POST /settings/inboxes] ❌ Erro ao garantir sessão WAHA:", error);
          console.log("[POST /settings/inboxes] 🧹 Limpando inbox criada devido ao erro");
          try {
            await supabaseAdmin.from("inbox_secrets").delete().eq("inbox_id", inbox.id);
          } catch {}
          try {
            await supabaseAdmin.from("inboxes").delete().eq("id", inbox.id);
          } catch {}
          const message = typeof error?.message === "string" ? error.message : "Falha ao criar sessao WAHA";
          return res.status(502).json({ error: message });
        }
      }

      if (body.add_current_as_manager && ctx.localUserId) {
        try {
          await supabaseAdmin
            .from("inbox_users")
            .upsert(
              [
                {
                  user_id: ctx.localUserId,
                  inbox_id: inbox.id,
                  can_read: true,
                  can_write: true,
                  can_manage: true,
                },
              ],
              { onConflict: "user_id,inbox_id" },
            );
        } catch {
          // ignore if link already exists
        }
      }

      try {
        getIO()?.emit("inbox:created", { companyId: ctx.companyId, inbox });
      } catch {
        // ignore socket errors
      }

      const { data: secretRow } = await supabaseAdmin
        .from("inbox_secrets")
        .select("inbox_id, access_token, refresh_token, provider_api_key")
        .eq("inbox_id", inbox.id)
        .maybeSingle();

      return res.status(201).json(mapInbox(inbox, secretRow as InboxSecretRow | null));
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "settings inbox create error";
      return res.status(status).json({ error: message });
    }
  });

  app.put("/settings/inboxes/:id", requireAuth, async (req: any, res) => {
    try {
      const ctx = await fetchActorContext(req);
      const { id } = req.params as { id: string };
      const { inbox: existingInbox } = await ensureManagePermission(id, ctx);

      const parsed = inboxUpdateSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Dados invalidos", details: parsed.error.format() });
      }
      const body = parsed.data;

      const update: Record<string, any> = {};
        if (body.name !== undefined) update.name = body.name;
        if (body.phone_number !== undefined) {
          const normalizedPhone = normalizeString(body.phone_number);
          update.phone_number =
            normalizedPhone ?? (existingInbox as any)?.phone_number ?? body.phone_number;
        }
      if (body.channel !== undefined) update.channel = body.channel;
      if (body.provider !== undefined) update.provider = body.provider.toUpperCase();
      if (body.is_active !== undefined) update.is_active = body.is_active;
      if (body.base_url !== undefined) update.base_url = normalizeString(body.base_url);
      if (body.api_version !== undefined) update.api_version = normalizeString(body.api_version);
      if (body.instance_id !== undefined) update.instance_id = normalizeString(body.instance_id);

      const existingProvider = ((existingInbox as any)?.provider || META_PROVIDER) as string;
      const provider = (update.provider || body.provider || existingProvider).toUpperCase();
      const resolvedMetaWebhook = provider === META_PROVIDER ? resolveMetaWebhookUrl(req) : null;
      if (provider === META_PROVIDER) {
        const metaWebhook =
          resolvedMetaWebhook ??
          (body.webhook_url !== undefined ? normalizeString(body.webhook_url) : undefined);
        if (metaWebhook !== undefined) {
          update.webhook_url = metaWebhook;
        }
      } else if (body.webhook_url !== undefined) {
        update.webhook_url = normalizeString(body.webhook_url);
      }
      const meta = extractMeta(provider, body.provider_config);
      const waha = extractWaha(provider, body.provider_config);
      const secretsUpdate: Record<string, any> = { inbox_id: id };
      const assignSecret = (
        key: "access_token" | "refresh_token" | "provider_api_key",
        value: string | null | undefined,
      ) => {
        const prepared = prepareSecretForStorage(value);
        if (prepared !== undefined) {
          secretsUpdate[key] = prepared;
        }
      };

        if (meta) {
          if (meta.phone_number_id !== undefined) {
            update.phone_number_id = normalizeString(meta.phone_number_id);
          }
          if (meta.waba_id !== undefined) {
            update.waba_id = normalizeString(meta.waba_id);
          }
          if (meta.webhook_verify_token !== undefined) {
            update.webhook_verify_token = normalizeString(meta.webhook_verify_token);
          }
          if (meta.app_secret !== undefined) {
            update.app_secret = normalizeString(meta.app_secret);
          }
          assignSecret("access_token", meta.access_token);
          assignSecret("refresh_token", meta.refresh_token);
          assignSecret("provider_api_key", meta.provider_api_key);
        }
        if (waha) {
          assignSecret("provider_api_key", waha.api_key);
        }
        if (provider === WAHA_PROVIDER) {
          const nextSessionId =
            (body.instance_id !== undefined ? normalizeString(body.instance_id) : undefined) ??
            (update.instance_id as string | undefined) ??
            ((existingInbox as any)?.instance_id as string | undefined) ??
            ((existingInbox as any)?.phone_number_id as string | undefined) ??
            null;
          if (nextSessionId) {
            update.instance_id = nextSessionId;
            update.phone_number_id = nextSessionId;
          }
          if (body.phone_number !== undefined && update.phone_number === undefined) {
            const normalized = normalizeString(body.phone_number);
            update.phone_number =
              normalized ?? (existingInbox as any)?.phone_number ?? nextSessionId ?? body.phone_number;
          }
          if (update.webhook_url === undefined && body.webhook_url === undefined) {
            update.webhook_url = null;
          }
        }

      if (Object.keys(update).length === 0 && Object.keys(secretsUpdate).length === 1) {
        return res.status(400).json({ error: "Nada para atualizar" });
      }
      update.updated_at = new Date().toISOString();

      if (Object.keys(update).length > 1) {
        const { error: updateErr } = await supabaseAdmin
          .from("inboxes")
          .update(update)
          .eq("id", id);
        if (updateErr) {
          return res.status(500).json({ error: updateErr.message });
        }
      }

      if (Object.keys(secretsUpdate).length > 1) {
        const { error: secretErr } = await supabaseAdmin
          .from("inbox_secrets")
          .upsert([secretsUpdate], { onConflict: "inbox_id" });
        if (secretErr) {
          return res.status(500).json({ error: secretErr.message });
        }
      }

      const fullInbox = await loadInboxWithSecret(id);
      try {
        getIO()?.emit("inbox:updated", {
          inboxId: id,
          companyId: ctx.companyId,
          inbox: fullInbox,
        });
      } catch {
        // ignore socket errors
      }
      return res.json(fullInbox);
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "settings inbox update error";
      return res.status(status).json({ error: message });
    }
  });

  app.delete("/settings/inboxes/:id", requireAuth, async (req: any, res) => {
    try {
      const ctx = await fetchActorContext(req);
      const { id } = req.params as { id: string };
      const { inbox: existingInbox } = await ensureManagePermission(id, ctx);

      // Clean related entities similarly to legacy route
      const { data: chatIds } = await supabaseAdmin
        .from("chats")
        .select("id")
        .eq("inbox_id", id);
      const ids = (chatIds || []).map((row) => row.id);
      if (ids.length > 0) {
        const CHUNK = 50;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const part = ids.slice(i, i + CHUNK);
          try {
            await supabaseAdmin.from("chat_messages").delete().in("chat_id", part);
          } catch {}
          try {
            await supabaseAdmin.from("chat_participants").delete().in("chat_id", part);
          } catch {}
          try {
            await supabaseAdmin.from("chat_tags").delete().in("chat_id", part);
          } catch {}
        }
        try {
          await supabaseAdmin.from("chats").delete().in("id", ids);
        } catch {}
      }

  try {
    await supabaseAdmin.from("inbox_users").delete().eq("inbox_id", id);
  } catch {}
  try {
    await supabaseAdmin.from("inbox_secrets").delete().eq("inbox_id", id);
  } catch {}

      const { error: deleteErr } = await supabaseAdmin.from("inboxes").delete().eq("id", id);
      if (deleteErr) {
        return res.status(500).json({ error: deleteErr.message });
      }

      try {
        getIO()?.emit("inbox:deleted", {
          inboxId: id,
          companyId: (existingInbox as any).company_id,
        });
      } catch {}

      return res.status(204).send();
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "settings inbox delete error";
      return res.status(status).json({ error: message });
    }
  });
}








