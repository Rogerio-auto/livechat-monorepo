import express from "express";
import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin, supabaseAnon } from "../lib/supabase.ts";
import { getIO } from "../lib/io.ts";
import { getRedis, rSet, clearCompanyListCaches, clearMessageCache } from "../lib/redis.ts";
import db from "../pg.ts";

// Middleware para verificar se é ADMIN
const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

async function requireAdmin(req: any, res: any, next: any) {
  const authUserId = req.user?.id;
  if (!authUserId) return res.status(401).json({ error: "Não autenticado" });
  
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("role")
    .eq("user_id", authUserId)
    .maybeSingle();
  
  const normalizedRole = String(user?.role || "").toUpperCase();
  if (!ADMIN_ROLES.includes(normalizedRole)) {
    return res.status(403).json({ error: "Acesso negado. Apenas administradores autorizados." });
  }
  
  next();
}

export function registerCompanyRoutes(app: express.Application) {
  // GET all companies (ADMIN only)
  app.get("/api/companies", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { data: companies, error } = await supabaseAdmin
        .from("companies")
        .select("id, name, email, phone, address, industry, created_at")
        .order("created_at", { ascending: false });
      
      if (error) return res.status(500).json({ error: error.message });
      
      // Buscar contadores para cada empresa
      const companiesWithCounts = await Promise.all(
        (companies || []).map(async (company: any) => {
          // Contar usuários
          const { count: usersCount } = await supabaseAdmin
            .from("users")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id);
          
          // Contar inboxes
          const { count: inboxesCount } = await supabaseAdmin
            .from("inboxes")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id);
          
          // Contar agentes
          const { count: agentsCount } = await supabaseAdmin
            .from("agents")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id);
          
          return {
            ...company,
            _count: {
              users: usersCount || 0,
              inboxes: inboxesCount || 0,
              agents: agentsCount || 0,
            },
          };
        })
      );
      
      return res.json(companiesWithCounts);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "companies list error" });
    }
  });

  // GET company details with analytics (ADMIN only)
  app.get("/api/admin/companies/:companyId", requireAuth, requireAdmin, async (req: any, res) => {
    const { companyId } = req.params;

    try {
      const companyFields = [
        "id",
        "name",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "zip_code",
        "cnpj",
        "logo",
        "plan",
        "is_active",
        "industry",
        "team_size",
        "created_at",
        "updated_at",
      ].join(", ");

      const { data: rawCompany, error: companyError } = await supabaseAdmin
        .from("companies")
        .select(companyFields)
        .eq("id", companyId)
        .maybeSingle();

      if (companyError) {
        return res.status(500).json({ error: companyError.message });
      }

      if (!rawCompany) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      const {
        count: usersCount,
        error: usersError,
      } = await supabaseAdmin
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (usersError) return res.status(500).json({ error: usersError.message });

      const {
        count: inboxesCount,
        error: inboxesError,
      } = await supabaseAdmin
        .from("inboxes")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (inboxesError) return res.status(500).json({ error: inboxesError.message });

      const {
        count: agentsCount,
        error: agentsError,
      } = await supabaseAdmin
        .from("agents")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (agentsError) return res.status(500).json({ error: agentsError.message });

      const {
        count: chatsCount,
        error: chatsError,
      } = await supabaseAdmin
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (chatsError) return res.status(500).json({ error: chatsError.message });

      const {
        count: messagesCount,
        error: messagesError,
      } = await supabaseAdmin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId);
      if (messagesError) return res.status(500).json({ error: messagesError.message });

      const { data: lastMessage } = await supabaseAdmin
        .from("messages")
        .select("created_at")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const normalizedStatus =
        (rawCompany as any)?.status ?? (rawCompany.is_active === false ? "inactive" : "active");

      return res.json({
        company: {
          ...rawCompany,
          status: normalizedStatus,
        },
        analytics: {
          counts: {
            users: usersCount || 0,
            inboxes: inboxesCount || 0,
            agents: agentsCount || 0,
            chats: chatsCount || 0,
          },
          usage: {
            messages: messagesCount || 0,
            lastMessageAt: lastMessage?.created_at ?? null,
            storage_used: "0 MB", // TODO: Implement real storage calculation
            tokens_used: 0, // TODO: Implement real token usage tracking
          },
          finance: {
            plan: rawCompany.plan ?? null,
            status: normalizedStatus,
            isActive: normalizedStatus !== "inactive",
          },
        },
      });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Erro ao carregar detalhes da empresa" });
    }
  });

  // GET current user's company data
  app.get("/companies/me", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id as string | null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const { data: comp, error: cerr } = await supabaseAdmin
        .from("companies")
        .select(
          "id, name, cnpj, email, phone, address, city, state, zip_code, logo, plan, is_active, industry, team_size, created_at, updated_at"
        )
        .eq("id", companyId)
        .maybeSingle();
      if (cerr) return res.status(500).json({ error: cerr.message });
      if (!comp) return res.status(404).json({ error: "Empresa não encontrada" });
      return res.json(comp);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "company get error" });
    }
  });

  // PUT update current user's company data (partial)
  app.put("/companies/me", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { data: urow, error: uerr } = await supabaseAdmin
        .from("users")
        .select("company_id")
        .eq("user_id", authUserId)
        .maybeSingle();
      if (uerr) return res.status(500).json({ error: uerr.message });
      const companyId = (urow as any)?.company_id as string | null;
      if (!companyId) return res.status(404).json({ error: "Usuário sem company_id" });

      const schema = z
        .object({
          name: z.string().min(1).optional(),
          cnpj: z.string().min(1).optional(),
          email: z.string().email().optional(),
          phone: z.string().min(3).optional(),
          address: z.string().optional().nullable(),
          city: z.string().optional().nullable(),
          state: z.string().optional().nullable(),
          zip_code: z.string().optional().nullable(),
          logo: z.string().url().optional().nullable(),
        })
        .passthrough();
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      }
      const body = parsed.data as any;
      const update: Record<string, any> = {};
      const fields = [
        "name",
        "cnpj",
        "email",
        "phone",
        "address",
        "city",
        "state",
        "zip_code",
        "logo",
      ] as const;
      for (const k of fields)
        if (Object.prototype.hasOwnProperty.call(body, k)) update[k] = body[k];
      update.updated_at = new Date().toISOString();
      if (Object.keys(update).length === 1) {
        return res.status(400).json({ error: "Nada para atualizar" });
      }

      const { data: updated, error } = await supabaseAdmin
        .from("companies")
        .update(update)
        .eq("id", companyId)
        .select(
          "id, name, cnpj, email, phone, address, city, state, zip_code, logo, plan, is_active, created_at, updated_at"
        )
        .single();
      if (error) return res.status(500).json({ error: error.message });

      try {
        getIO()?.emit("company:updated", { companyId, changes: update, company: updated });
      } catch {}

      return res.json(updated);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "company update error" });
    }
  });

  // DELETE company permanently (ADMIN only with password verification)
  app.delete("/api/admin/companies/:companyId/delete", requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { companyId } = req.params;
      const { password } = req.body;

      if (!password) {
        return res.status(400).json({ error: "Senha é obrigatória para confirmar a exclusão" });
      }

      // Verificar senha do admin
      const authUserId = req.user.id;
      const { data: adminUser } = await supabaseAdmin
        .from("users")
        .select("email")
        .eq("user_id", authUserId)
        .maybeSingle();

      if (!adminUser?.email) {
        return res.status(404).json({ error: "Usuário administrador não encontrado" });
      }

      // Tentar fazer login com as credenciais para validar senha
      const { error: authError } = await supabaseAnon.auth.signInWithPassword({
        email: adminUser.email,
        password: password,
      });

      if (authError) {
        return res.status(401).json({ error: "Senha incorreta" });
      }

      // Verificar se a empresa existe
      const { data: company, error: companyError } = await supabaseAdmin
        .from("companies")
        .select("id, name")
        .eq("id", companyId)
        .maybeSingle();

      if (companyError || !company) {
        return res.status(404).json({ error: "Empresa não encontrada" });
      }

      console.log(`[ADMIN DELETE] Iniciando exclusão da empresa: ${company.name} (${companyId})`);

      // Buscar todos os usuários da empresa
      const { data: users } = await supabaseAdmin
        .from("users")
        .select("user_id, email")
        .eq("company_id", companyId);

      // Deletar usuários da autenticação do Supabase
      if (users && users.length > 0) {
        console.log(`[ADMIN DELETE] Deletando ${users.length} usuários da autenticação...`);
        for (const user of users) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(user.user_id);
            console.log(`[ADMIN DELETE] Usuário deletado: ${user.email}`);
          } catch (err) {
            console.error(`[ADMIN DELETE] Erro ao deletar usuário ${user.email}:`, err);
          }
        }
      }

      // Deletar chats e mensagens relacionadas
      console.log(`[ADMIN DELETE] Deletando chats e mensagens...`);
      const { data: chats } = await supabaseAdmin
        .from("chats")
        .select("id")
        .eq("company_id", companyId);

      if (chats && chats.length > 0) {
        const chatIds = chats.map(c => c.id);
        
        // Deletar mensagens dos chats
        await supabaseAdmin
          .from("messages")
          .delete()
          .in("chat_id", chatIds);
        
        // Deletar chats
        await supabaseAdmin
          .from("chats")
          .delete()
          .eq("company_id", companyId);
      }

      // Deletar agentes e suas ferramentas
      console.log(`[ADMIN DELETE] Deletando agentes...`);
      const { data: agents } = await supabaseAdmin
        .from("agents")
        .select("id")
        .eq("company_id", companyId);

      if (agents && agents.length > 0) {
        const agentIds = agents.map(a => a.id);
        
        // Deletar ferramentas dos agentes
        await supabaseAdmin
          .from("agent_tools")
          .delete()
          .in("agent_id", agentIds);
        
        // Deletar agentes
        await supabaseAdmin
          .from("agents")
          .delete()
          .eq("company_id", companyId);
      }

      // Deletar inboxes
      console.log(`[ADMIN DELETE] Deletando inboxes...`);
      await supabaseAdmin
        .from("inboxes")
        .delete()
        .eq("company_id", companyId);

      // Deletar departamentos e times
      console.log(`[ADMIN DELETE] Deletando departamentos e times...`);
      const { data: departments } = await supabaseAdmin
        .from("departments")
        .select("id")
        .eq("company_id", companyId);

      if (departments && departments.length > 0) {
        const deptIds = departments.map(d => d.id);
        
        // Deletar times
        await supabaseAdmin
          .from("teams")
          .delete()
          .in("department_id", deptIds);
        
        // Deletar departamentos
        await supabaseAdmin
          .from("departments")
          .delete()
          .eq("company_id", companyId);
      }

      // Deletar campanhas
      console.log(`[ADMIN DELETE] Deletando campanhas...`);
      await supabaseAdmin
        .from("campaigns")
        .delete()
        .eq("company_id", companyId);

      // Deletar boards do kanban
      console.log(`[ADMIN DELETE] Deletando boards...`);
      const { data: boards } = await supabaseAdmin
        .from("boards")
        .select("id")
        .eq("company_id", companyId);

      if (boards && boards.length > 0) {
        const boardIds = boards.map(b => b.id);
        
        // Deletar cards
        await supabaseAdmin
          .from("cards")
          .delete()
          .in("board_id", boardIds);
        
        // Deletar boards
        await supabaseAdmin
          .from("boards")
          .delete()
          .eq("company_id", companyId);
      }

      // Deletar usuários da tabela users
      console.log(`[ADMIN DELETE] Deletando registros de usuários...`);
      await supabaseAdmin
        .from("users")
        .delete()
        .eq("company_id", companyId);

      // Por último, deletar a empresa
      console.log(`[ADMIN DELETE] Deletando empresa...`);
      const { error: deleteError } = await supabaseAdmin
        .from("companies")
        .delete()
        .eq("id", companyId);

      if (deleteError) {
        console.error(`[ADMIN DELETE] Erro ao deletar empresa:`, deleteError);
        return res.status(500).json({ error: deleteError.message });
      }

      console.log(`[ADMIN DELETE] ✅ Empresa ${company.name} deletada com sucesso`);

      // Emitir evento via socket
      try {
        getIO()?.emit("company:deleted", { companyId, companyName: company.name });
      } catch {}

      return res.json({ 
        success: true, 
        message: `Empresa ${company.name} e todos os dados relacionados foram deletados permanentemente` 
      });
    } catch (e: any) {
      console.error(`[ADMIN DELETE] Erro geral:`, e);
      return res.status(500).json({ error: e?.message || "Erro ao deletar empresa" });
    }
  });

  // POST Reset Cache
  app.post("/api/admin/companies/:companyId/cache/reset", requireAuth, requireAdmin, async (req: any, res) => {
    const { companyId } = req.params;
    try {
      const redis = getRedis();
      // Padrões de chaves para limpar
      const patterns = [
        `company:${companyId}:*`,
        `session:${companyId}:*`,
        `chat:${companyId}:*`
      ];
      
      let deletedCount = 0;
      for (const pattern of patterns) {
        const keys = await redis.keys(pattern);
        if (keys.length > 0) {
          await redis.del(...keys);
          deletedCount += keys.length;
        }
      }

      // Limpar caches de lista (LiveChat)
      await clearCompanyListCaches(companyId);

      // Limpar contexto dos agentes e caches de mensagens
      try {
        const chats = await db.any<{ id: string }>(
          `SELECT id FROM chats WHERE company_id = $1`,
          [companyId]
        );
        
        if (chats.length > 0) {
          const chatIds = chats.map(c => c.id);
          
          // 1. Agent Context & Chat Details
          const keysToDelete = chatIds.flatMap(id => [
            `agent:context:${id}`, // Memória do agente
            `lc:chat:${id}`        // Cache de detalhes do chat
          ]);

          // Deletar em batches
          const BATCH_SIZE = 500;
          for (let i = 0; i < keysToDelete.length; i += BATCH_SIZE) {
              const batch = keysToDelete.slice(i, i + BATCH_SIZE);
              if (batch.length > 0) {
                const deleted = await redis.del(...batch);
                deletedCount += deleted;
              }
          }

          // 2. Limpar cache de mensagens (mais pesado, fazer em background ou sequencial)
          // Vamos limpar apenas os sets de mensagens para invalidar
          for (const chatId of chatIds) {
             // Não vamos aguardar cada um individualmente para não bloquear muito tempo
             clearMessageCache(chatId).catch(err => console.warn(`Failed to clear msg cache for ${chatId}`, err));
          }
        }
      } catch (err) {
        console.error(`[ADMIN] Erro ao limpar contexto de agentes:`, err);
      }
      
      console.log(`[ADMIN] Cache reset for company ${companyId}. Deleted ${deletedCount} keys.`);
      return res.json({ success: true, deletedCount });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // POST Suspend/Activate
  app.post("/api/admin/companies/:companyId/toggle-status", requireAuth, requireAdmin, async (req: any, res) => {
    const { companyId } = req.params;
    try {
      // Buscar status atual
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("is_active")
        .eq("id", companyId)
        .single();
        
      if (!company) return res.status(404).json({ error: "Empresa não encontrada" });
      
      const newStatus = !company.is_active;
      
      const { error } = await supabaseAdmin
        .from("companies")
        .update({ is_active: newStatus })
        .eq("id", companyId);
        
      if (error) throw error;
      
      return res.json({ success: true, is_active: newStatus });
    } catch (e: any) {
      return res.status(500).json({ error: e.message });
    }
  });

  // POST Impersonate
  app.post("/api/admin/companies/:companyId/impersonate", requireAuth, requireAdmin, async (req: any, res) => {
    const { companyId } = req.params;
    try {
      // Buscar um usuário admin desta empresa
      const { data: user } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("company_id", companyId)
        .eq("role", "ADMIN")
        .limit(1)
        .maybeSingle();
        
      let targetUser = user;

      if (!targetUser) {
        // Tenta qualquer usuário se não tiver admin
        const { data: anyUser } = await supabaseAdmin
          .from("users")
          .select("*")
          .eq("company_id", companyId)
          .limit(1)
          .maybeSingle();
          
        if (!anyUser) return res.status(404).json({ error: "Nenhum usuário encontrado nesta empresa" });
        targetUser = anyUser;
      }
      
      // Gerar token de sessão manual e injetar no Redis
      // Isso bypassa a verificação do Supabase Auth e usa o cache do requireAuth
      const sessionToken = crypto.randomUUID();
      const tokenHash = Buffer.from(sessionToken).toString("base64").slice(0, 32);
      const cacheKey = `auth:token:${tokenHash}`;
      
      const authData = {
        user: {
          id: targetUser.user_id,
          email: targetUser.email,
          app_metadata: { provider: "impersonation" },
          user_metadata: { company_id: companyId, role: targetUser.role },
          aud: "authenticated",
          role: "authenticated"
        },
        profile: targetUser
      };
      
      // Salvar no Redis por 1 hora (3600s)
      await rSet(cacheKey, authData, 3600);
      
      // Setar cookie
      res.cookie(process.env.JWT_COOKIE_NAME || "sb_access_token", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 3600 * 1000, // 1 hour
        path: "/"
      });
      
      return res.json({ success: true, user: targetUser });
    } catch (e: any) {
      console.error("Impersonate error:", e);
      return res.status(500).json({ error: e.message });
    }
  });
}
