import type { Application } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { checkResourceLimit } from "../middlewares/checkSubscription.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { getIO } from "../lib/io.js";
import { APP_URL } from "../config/env.js";

const ROLE_VALUES = ["AGENT", "SUPERVISOR", "TECHNICIAN", "MANAGER"] as const;
const ROLE_ARRAY = [...ROLE_VALUES];
const USERS_SELECT =
  "id, email, name, avatar, role, status, is_online, last_seen, company_id, user_id";
const INVITE_REDIRECT_PATH = "/convite";
const INVITE_REDIRECT_TO =
  process.env.SUPABASE_INVITE_REDIRECT ||
  `${APP_URL.replace(/\/$/, "")}${INVITE_REDIRECT_PATH}`;

type Role = (typeof ROLE_VALUES)[number];

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(ROLE_VALUES).default("AGENT"),
  avatarUrl: z.string().url().optional(),
});

const updateUserSchema = z
  .object({
    name: z.string().min(1).optional(),
    email: z.string().email().optional(),
    role: z.enum(ROLE_VALUES).optional(),
    avatarUrl: z.string().url().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nada para atualizar",
  });

async function fetchActorContext(req: any) {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("id, company_id, role")
    .eq("user_id", req.user.id)
    .maybeSingle();
  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }
  if (!data?.company_id) {
    throw Object.assign(new Error("Usuario sem company_id"), { status: 404 });
  }
  return {
    companyId: data.company_id as string,
    localUserId: (data.id as string) || null,
    role: (data.role as Role | null) ?? null,
  };
}

export function registerSettingsUsersRoutes(app: Application) {
  // Current authenticated user's profile (settings scope)
  app.get("/settings/users/me", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user?.id as string;
      if (!authUserId) return res.status(401).json({ error: "Not authenticated" });

      const { data, error } = await supabaseAdmin
        .from("users")
        .select("id, name, email, avatar, role, status, company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (error) return res.status(500).json({ error: error.message });
      if (!data) return res.status(404).json({ error: "Usuario não encontrado" });

      // Minimal shape expected by frontend livechat page
      return res.json({
        id: data.id,
        name: data.name || data.email || "Usuário",
        email: data.email || null,
        avatar: (data as any).avatar || null,
        role: (data as any).role || null,
        status: (data as any).status || null,
      });
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "me profile error";
      return res.status(status).json({ error: message });
    }
  });

  app.get("/settings/users", requireAuth, async (req: any, res) => {
    try {
      const { companyId } = await fetchActorContext(req);

      const { data, error } = await supabaseAdmin
        .from("users")
        .select(USERS_SELECT)
        .eq("company_id", companyId)
        .in("role", ROLE_ARRAY)
        .order("name", { ascending: true });
      if (error) return res.status(500).json({ error: error.message });

      return res.json(data ?? []);
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "users list error";
      return res.status(status).json({ error: message });
    }
  });

  app.post("/settings/users", requireAuth, checkResourceLimit("users"), async (req: any, res) => {
    try {
      const { companyId } = await fetchActorContext(req);

      const parsed = createUserSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Dados invalidos", details: parsed.error.format() });
      }
      const payload = parsed.data;

      const { data: existing } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("email", payload.email)
        .maybeSingle();
      if (existing) {
        return res
          .status(409)
          .json({ error: "Email ja cadastrado para um colaborador" });
      }

      const inviteOptions: Record<string, any> = {
        data: { name: payload.name, company_id: companyId },
      };
      if (INVITE_REDIRECT_TO) {
        inviteOptions.redirectTo = INVITE_REDIRECT_TO;
      }
      const { data: inviteData, error: inviteError } =
        await supabaseAdmin.auth.admin.inviteUserByEmail(
          payload.email,
          inviteOptions,
        );
      if (inviteError) {
        return res.status(400).json({ error: inviteError.message });
      }

      const invitedUserId = (inviteData?.user?.id as string | undefined) ?? null;
      if (!invitedUserId) {
        return res
          .status(500)
          .json({ error: "Nao foi possivel criar o usuario de autenticacao" });
      }

      const insertBody: Record<string, any> = {
        name: payload.name,
        email: payload.email,
        role: payload.role,
        company_id: companyId,
        user_id: invitedUserId,
      };
      if (payload.avatarUrl) insertBody.avatar = payload.avatarUrl;

      const { data: inserted, error: insertError } = await supabaseAdmin
        .from("users")
        .insert([insertBody])
        .select(USERS_SELECT)
        .single();
      if (insertError) {
        if (invitedUserId) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(invitedUserId);
          } catch {}
        }
        return res.status(500).json({ error: insertError.message });
      }

      try {
        getIO()?.emit("users:updated", {
          companyId,
          action: "created",
          userId: inserted.id,
        });
      } catch {}

      return res.status(201).json(inserted);
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "user create error";
      return res.status(status).json({ error: message });
    }
  });

  app.put("/settings/users/:id", requireAuth, async (req: any, res) => {
    try {
      const { companyId } = await fetchActorContext(req);
      const { id } = req.params as { id: string };

      const parsed = updateUserSchema.safeParse(req.body || {});
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Dados invalidos", details: parsed.error.format() });
      }
      const payload = parsed.data;

      const { data: target, error: targetErr } = await supabaseAdmin
        .from("users")
        .select("id, company_id, user_id, email")
        .eq("id", id)
        .maybeSingle();
      if (targetErr) {
        return res.status(500).json({ error: targetErr.message });
      }
      if (!target || (target as any).company_id !== companyId) {
        return res.status(404).json({ error: "Usuario não encontrado" });
      }

      const currentEmail = (target as any).email as string | undefined;
      const emailChanged =
        payload.email !== undefined &&
        payload.email.toLowerCase() !== (currentEmail || "").toLowerCase();
      if (emailChanged) {
        const { data: duplicate } = await supabaseAdmin
          .from("users")
          .select("id")
          .eq("email", payload.email)
          .maybeSingle();
        if (duplicate && duplicate.id !== id) {
          return res
            .status(409)
            .json({ error: "Email ja cadastrado para um colaborador" });
        }
      }

      const updates: Record<string, any> = {};
      if (payload.name !== undefined) updates.name = payload.name;
      if (emailChanged) updates.email = payload.email;
      if (payload.role !== undefined) updates.role = payload.role;
      if (payload.avatarUrl !== undefined) updates.avatar = payload.avatarUrl;
      updates.updated_at = new Date().toISOString();

      const authUserId = (target as any).user_id as string | null;
      if (authUserId && emailChanged) {
        const { error: authUpdateError } =
          await supabaseAdmin.auth.admin.updateUserById(authUserId, {
            email: payload.email,
          });
        if (authUpdateError) {
          return res.status(400).json({ error: authUpdateError.message });
        }
      }

      if (Object.keys(updates).length <= 1) {
        return res.status(400).json({ error: "Nada para atualizar" });
      }

      const { data: updated, error: updateErr } = await supabaseAdmin
        .from("users")
        .update(updates)
        .eq("id", id)
        .select(USERS_SELECT)
        .single();
      if (updateErr) {
        return res.status(500).json({ error: updateErr.message });
      }

      try {
        getIO()?.emit("users:updated", {
          companyId,
          action: "updated",
          userId: updated.id,
        });
      } catch {}

      return res.json(updated);
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "user update error";
      return res.status(status).json({ error: message });
    }
  });

  app.post("/settings/users/:id/resend-invite", requireAuth, async (req: any, res) => {
    try {
      const { companyId } = await fetchActorContext(req);
      const { id } = req.params as { id: string };

      // Buscar usuário
      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, company_id, user_id, email, name")
        .eq("id", id)
        .maybeSingle();

      if (userError) {
        return res.status(500).json({ error: userError.message });
      }
      if (!user || user.company_id !== companyId) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Reenviar convite usando o Supabase Admin
      const inviteOptions: Record<string, any> = {
        data: { name: user.name, company_id: companyId },
      };
      if (INVITE_REDIRECT_TO) {
        inviteOptions.redirectTo = INVITE_REDIRECT_TO;
      }

      const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        user.email,
        inviteOptions,
      );

      if (inviteError) {
        return res.status(400).json({ error: inviteError.message });
      }

      return res.json({ success: true, message: "Convite reenviado com sucesso" });
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "Erro ao reenviar convite";
      return res.status(status).json({ error: message });
    }
  });

  app.delete("/settings/users/:id", requireAuth, async (req: any, res) => {
    try {
      const { companyId } = await fetchActorContext(req);
      const { id } = req.params as { id: string };

      const { data: target, error: targetErr } = await supabaseAdmin
        .from("users")
        .select("id, company_id, user_id")
        .eq("id", id)
        .maybeSingle();
      if (targetErr) {
        return res.status(500).json({ error: targetErr.message });
      }
      if (!target || (target as any).company_id !== companyId) {
        return res.status(404).json({ error: "Usuario não encontrado" });
      }

      const authUserId = (target as any).user_id as string | null;

      const { error: deleteErr } = await supabaseAdmin
        .from("users")
        .delete()
        .eq("id", id);
      if (deleteErr) {
        return res.status(500).json({ error: deleteErr.message });
      }

      if (authUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        } catch {}
      }

      try {
        getIO()?.emit("users:updated", {
          companyId,
          action: "deleted",
          userId: id,
        });
      } catch {}

      return res.status(204).send();
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "user delete error";
      return res.status(status).json({ error: message });
    }
  });

  // Get user's inbox access
  app.get("/settings/users/:id/inboxes", requireAuth, async (req: any, res) => {
    try {
      const { companyId } = await fetchActorContext(req);
      const { id } = req.params as { id: string };

      // Verify user belongs to same company
      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("id", id)
        .maybeSingle();

      if (userError) {
        return res.status(500).json({ error: userError.message });
      }
      if (!user || user.company_id !== companyId) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Get inbox_users links
      const { data: links, error: linksError } = await supabaseAdmin
        .from("inbox_users")
        .select("inbox_id, can_read, can_write, can_manage")
        .eq("user_id", id);

      if (linksError) {
        return res.status(500).json({ error: linksError.message });
      }

      return res.json(links || []);
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "inbox access list error";
      return res.status(status).json({ error: message });
    }
  });

  // Add user to inbox
  app.post("/settings/users/:id/inboxes", requireAuth, async (req: any, res) => {
    try {
      const { companyId } = await fetchActorContext(req);
      const { id } = req.params as { id: string };
      const { inbox_id, can_read = true, can_write = true, can_manage = false } = req.body || {};

      if (!inbox_id) {
        return res.status(400).json({ error: "inbox_id é obrigatório" });
      }

      // Verify user belongs to same company
      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("id", id)
        .maybeSingle();

      if (userError) {
        return res.status(500).json({ error: userError.message });
      }
      if (!user || user.company_id !== companyId) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Verify inbox belongs to same company
      const { data: inbox, error: inboxError } = await supabaseAdmin
        .from("inboxes")
        .select("id, company_id")
        .eq("id", inbox_id)
        .maybeSingle();

      if (inboxError) {
        return res.status(500).json({ error: inboxError.message });
      }
      if (!inbox || inbox.company_id !== companyId) {
        return res.status(404).json({ error: "Caixa de entrada não encontrada" });
      }

      // Check if already exists
      const { data: existing } = await supabaseAdmin
        .from("inbox_users")
        .select("user_id, inbox_id")
        .eq("user_id", id)
        .eq("inbox_id", inbox_id)
        .maybeSingle();

      if (existing) {
        return res.status(409).json({ error: "Usuário já tem acesso a esta caixa de entrada" });
      }

      // Create inbox_users link
      const { data: link, error: linkError } = await supabaseAdmin
        .from("inbox_users")
        .insert([{
          user_id: id,
          inbox_id,
          can_read,
          can_write,
          can_manage,
        }])
        .select("inbox_id, can_read, can_write, can_manage")
        .single();

      if (linkError) {
        return res.status(500).json({ error: linkError.message });
      }

      return res.status(201).json(link);
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "inbox access add error";
      return res.status(status).json({ error: message });
    }
  });

  // Remove user from inbox
  app.delete("/settings/users/:id/inboxes/:inboxId", requireAuth, async (req: any, res) => {
    try {
      const { companyId } = await fetchActorContext(req);
      const { id, inboxId } = req.params as { id: string; inboxId: string };

      // Verify user belongs to same company
      const { data: user, error: userError } = await supabaseAdmin
        .from("users")
        .select("id, company_id")
        .eq("id", id)
        .maybeSingle();

      if (userError) {
        return res.status(500).json({ error: userError.message });
      }
      if (!user || user.company_id !== companyId) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      // Verify inbox belongs to same company
      const { data: inbox, error: inboxError } = await supabaseAdmin
        .from("inboxes")
        .select("id, company_id")
        .eq("id", inboxId)
        .maybeSingle();

      if (inboxError) {
        return res.status(500).json({ error: inboxError.message });
      }
      if (!inbox || inbox.company_id !== companyId) {
        return res.status(404).json({ error: "Caixa de entrada não encontrada" });
      }

      // Delete inbox_users link
      const { error: deleteError } = await supabaseAdmin
        .from("inbox_users")
        .delete()
        .eq("user_id", id)
        .eq("inbox_id", inboxId);

      if (deleteError) {
        return res.status(500).json({ error: deleteError.message });
      }

      return res.status(204).send();
    } catch (e: any) {
      const status = Number(e?.status) || 500;
      const message = e?.message || "inbox access remove error";
      return res.status(status).json({ error: message });
    }
  });
}
