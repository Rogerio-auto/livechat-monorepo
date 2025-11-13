import type { Application } from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";

const DepartmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
  icon: z.string().optional().nullable(),
  is_active: z.boolean().optional()
});

export function registerDepartmentsRoutes(app: Application) {
  console.log("[DEPARTMENTS] 🏢 Registering departments routes");
  
  // 📋 GET /api/departments - Listar departamentos da empresa
  app.get("/api/departments", requireAuth, async (req: any, res) => {
    try {
      console.log("[GET /api/departments] Request received");
      console.log("[GET /api/departments] req.user:", req.user);
      console.log("[GET /api/departments] req.profile:", req.profile);
      
      const companyId = req.user?.company_id;
      if (!companyId) {
        console.error("[GET /api/departments] No company_id found in req.user");
        return res.status(401).json({ error: "Empresa não identificada" });
      }
      
      console.log("[GET /api/departments] Querying for company_id:", companyId);
      
      const { data, error } = await supabaseAdmin
        .from("departments")
        .select(`
          *,
          teams:teams(count),
          active_chats:chats!department_id(count)
        `)
        .eq("company_id", companyId)
        .order("name", { ascending: true });
      
      if (error) throw error;
      
      return res.json(data || []);
    } catch (error: any) {
      console.error("[GET /api/departments] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 🔍 GET /api/departments/:id - Buscar departamento específico
  app.get("/api/departments/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;
      
      const { data, error } = await supabaseAdmin
        .from("departments")
        .select("*")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) {
        return res.status(404).json({ error: "Departamento não encontrado" });
      }
      
      return res.json(data);
    } catch (error: any) {
      console.error("[GET /api/departments/:id] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // ➕ POST /api/departments - Criar departamento
  app.post("/api/departments", requireAuth, async (req: any, res) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) {
        return res.status(401).json({ error: "Empresa não identificada" });
      }
      
      const parsed = DepartmentSchema.parse(req.body);
      
      // Verificar se já existe departamento com mesmo nome
      const { data: existing } = await supabaseAdmin
        .from("departments")
        .select("id")
        .eq("company_id", companyId)
        .ilike("name", parsed.name)
        .maybeSingle();
      
      if (existing) {
        return res.status(409).json({ 
          error: "Já existe um departamento com este nome" 
        });
      }
      
      const { data, error } = await supabaseAdmin
        .from("departments")
        .insert({
          ...parsed,
          company_id: companyId
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[POST /api/departments] Created: ${data.id} - ${data.name}`);
      return res.status(201).json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: error.issues 
        });
      }
      console.error("[POST /api/departments] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // ✏️ PUT /api/departments/:id - Atualizar departamento
  app.put("/api/departments/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;
      const parsed = DepartmentSchema.partial().parse(req.body);
      
      // Verificar propriedade
      const { data: dept } = await supabaseAdmin
        .from("departments")
        .select("company_id")
        .eq("id", id)
        .maybeSingle();
      
      if (!dept || dept.company_id !== companyId) {
        return res.status(404).json({ error: "Departamento não encontrado" });
      }
      
      // Se mudando nome, verificar duplicatas
      if (parsed.name) {
        const { data: existing } = await supabaseAdmin
          .from("departments")
          .select("id")
          .eq("company_id", companyId)
          .ilike("name", parsed.name)
          .neq("id", id)
          .maybeSingle();
        
        if (existing) {
          return res.status(409).json({ 
            error: "Já existe outro departamento com este nome" 
          });
        }
      }
      
      const { data, error } = await supabaseAdmin
        .from("departments")
        .update(parsed)
        .eq("id", id)
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`[PUT /api/departments/:id] Updated: ${id}`);
      return res.json(data);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Dados inválidos", 
          details: error.issues 
        });
      }
      console.error("[PUT /api/departments/:id] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 🗑️ DELETE /api/departments/:id - Deletar departamento
  app.delete("/api/departments/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;
      
      // Verificar propriedade
      const { data: dept } = await supabaseAdmin
        .from("departments")
        .select("company_id, name")
        .eq("id", id)
        .maybeSingle();
      
      if (!dept || dept.company_id !== companyId) {
        return res.status(404).json({ error: "Departamento não encontrado" });
      }
      
      // Verificar se há times vinculados
      const { count: teamsCount } = await supabaseAdmin
        .from("teams")
        .select("id", { count: "exact", head: true })
        .eq("department_id", id);
      
      if (teamsCount && teamsCount > 0) {
        return res.status(409).json({ 
          error: `Não é possível excluir departamento com ${teamsCount} time(s) vinculado(s)`,
          teams_count: teamsCount
        });
      }
      
      // Verificar se há chats vinculados (opcional: pode permitir e setar NULL)
      const { count: chatsCount } = await supabaseAdmin
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("department_id", id);
      
      if (chatsCount && chatsCount > 0) {
        // Opção 1: Bloquear exclusão
        return res.status(409).json({ 
          error: `Não é possível excluir departamento com ${chatsCount} conversa(s) vinculada(s)`,
          chats_count: chatsCount
        });
        
        // Opção 2: Permitir e setar NULL (descomente abaixo se preferir)
        /*
        await supabaseAdmin
          .from("chats")
          .update({ department_id: null })
          .eq("department_id", id);
        */
      }
      
      const { error } = await supabaseAdmin
        .from("departments")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      console.log(`[DELETE /api/departments/:id] Deleted: ${id} - ${dept.name}`);
      return res.status(204).send();
    } catch (error: any) {
      console.error("[DELETE /api/departments/:id] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 📊 GET /api/departments/:id/metrics - Métricas do departamento
  app.get("/api/departments/:id/metrics", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const companyId = req.user.company_id;
      
      // Verificar propriedade
      const { data: dept } = await supabaseAdmin
        .from("departments")
        .select("company_id, name")
        .eq("id", id)
        .maybeSingle();
      
      if (!dept || dept.company_id !== companyId) {
        return res.status(404).json({ error: "Departamento não encontrado" });
      }
      
      // Métricas em tempo real
      const { count: activeChats } = await supabaseAdmin
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("department_id", id)
        .in("status", ["OPEN", "PENDING"]);
      
      const { count: totalChatsToday } = await supabaseAdmin
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("department_id", id)
        .gte("created_at", new Date().toISOString().split('T')[0]);
      
      const { count: totalChats } = await supabaseAdmin
        .from("chats")
        .select("id", { count: "exact", head: true })
        .eq("department_id", id);
      
      // Métricas históricas (últimos 30 dias)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: historical } = await supabaseAdmin
        .from("department_metrics")
        .select("*")
        .eq("department_id", id)
        .gte("date", thirtyDaysAgo.toISOString().split('T')[0])
        .order("date", { ascending: false });
      
      return res.json({
        department_id: id,
        department_name: dept.name,
        realtime: {
          active_chats: activeChats || 0,
          total_today: totalChatsToday || 0,
          total_all_time: totalChats || 0
        },
        historical: historical || []
      });
    } catch (error: any) {
      console.error("[GET /api/departments/:id/metrics] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });

  // 📊 GET /api/departments/stats/summary - Resumo de todos os departamentos
  app.get("/api/departments/stats/summary", requireAuth, async (req: any, res) => {
    try {
      const companyId = req.user.company_id;
      if (!companyId) {
        return res.status(401).json({ error: "Empresa não identificada" });
      }
      
      const { data: departments } = await supabaseAdmin
        .from("departments")
        .select("id, name, color")
        .eq("company_id", companyId)
        .eq("is_active", true);
      
      if (!departments || departments.length === 0) {
        return res.json([]);
      }
      
      const summary = await Promise.all(
        departments.map(async (dept) => {
          const { count: activeChats } = await supabaseAdmin
            .from("chats")
            .select("id", { count: "exact", head: true })
            .eq("department_id", dept.id)
            .in("status", ["OPEN", "PENDING"]);
          
          const { count: totalChats } = await supabaseAdmin
            .from("chats")
            .select("id", { count: "exact", head: true })
            .eq("department_id", dept.id);
          
          return {
            id: dept.id,
            name: dept.name,
            color: dept.color,
            active_chats: activeChats || 0,
            total_chats: totalChats || 0
          };
        })
      );
      
      return res.json(summary);
    } catch (error: any) {
      console.error("[GET /api/departments/stats/summary] Error:", error);
      return res.status(500).json({ error: error.message });
    }
  });
}
