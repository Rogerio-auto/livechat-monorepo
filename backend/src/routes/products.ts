import type { Application } from "express";
import { z } from "zod";

import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";

const PRODUCTS_TABLE = "catalog_items";

function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\./g, "").replace(/,/, ".").replace(/[^0-9.-]/g, "");
  const numeric = Number(normalized);
  return Number.isNaN(numeric) ? null : numeric;
}

function respondWithProductsError(res: any, error: unknown, fallback: string) {
  const status = typeof (error as any)?.status === "number" ? Number((error as any).status) : 500;
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : fallback;
  return res.status(status).json({ error: message || fallback });
}

async function resolveProductsCompanyId(req: any): Promise<string> {
  const cached = typeof req?.user?.company_id === "string" ? req.user.company_id.trim() : "";
  if (cached) return cached;

  const authUserId = typeof req?.user?.id === "string" ? req.user.id : "";
  if (!authUserId) {
    throw Object.assign(new Error("Not authenticated"), { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("users")
    .select("company_id")
    .eq("user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw Object.assign(new Error(error.message), { status: 500 });
  }

  const companyId = typeof (data as any)?.company_id === "string" ? (data as any).company_id : null;
  if (!companyId) {
    throw Object.assign(new Error("Usuário sem empresa associada"), { status: 403 });
  }

  if (req?.user) {
    req.user.company_id = companyId;
  }

  return companyId;
}

export function registerProductRoutes(app: Application) {
  app.get("/api/products", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveProductsCompanyId(req);
      const q = (req.query.q as string | undefined)?.trim();
      const status = (req.query.status as string | undefined)?.trim();
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      let query = supabaseAdmin
        .from(PRODUCTS_TABLE)
        .select("*", { count: "exact" })
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false });

      if (q) query = query.ilike("name", `%${q}%`);
      if (status && status.toLowerCase() !== "all") query = query.eq("status", status);
      if (typeof limit === "number" && typeof offset === "number") {
        query = query.range(offset, offset + Math.max(0, limit - 1));
      }

      const { data, error, count } = await query;
      if (error) return respondWithProductsError(res, error, "Products list error");
      return res.json({ items: data || [], total: count ?? (data?.length || 0) });
    } catch (error) {
      return respondWithProductsError(res, error, "Products list error");
    }
  });

  app.post("/api/products", requireAuth, async (req: any, res) => {
    try {
      const companyId = await resolveProductsCompanyId(req);
      const schema = z
        .object({
          external_id: z.string().optional(),
          name: z.string().min(1),
          description: z.string().optional().nullable(),
          sku: z.string().optional().nullable(),
          unit: z.string().nullable().optional(),
          item_type: z.enum(["PRODUCT", "SERVICE", "SUBSCRIPTION"]).optional(),
          cost_price: z.union([z.number(), z.string()]).nullable().optional(),
          sale_price: z.union([z.number(), z.string()]).nullable().optional(),
          duration_minutes: z.number().optional().nullable(),
          billing_type: z.string().optional().nullable(),
          brand: z.string().nullable().optional(),
          grouping: z.string().nullable().optional(),
          power: z.string().nullable().optional(),
          size: z.string().nullable().optional(),
          supplier: z.string().nullable().optional(),
          status: z.string().nullable().optional(),
          specs: z.string().nullable().optional(),
        })
        .passthrough();

      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const payload: Record<string, unknown> = { ...parsed.data };
      if (payload.cost_price !== undefined) payload.cost_price = parseMoney(payload.cost_price);
      if (payload.sale_price !== undefined) payload.sale_price = parseMoney(payload.sale_price);
      if (!payload.item_type) payload.item_type = "PRODUCT"; // Padrão
      payload.company_id = companyId;
      payload.is_active = true; // Padrão ativo

      const { data, error } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .insert([payload])
        .select("*")
        .single();

      if (error) return respondWithProductsError(res, error, "Create product error");
      return res.status(201).json(data);
    } catch (error) {
      return respondWithProductsError(res, error, "Create product error");
    }
  });

  app.put("/api/products/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    const schema = z
      .object({
        external_id: z.string().optional(),
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        sku: z.string().optional().nullable(),
        unit: z.string().optional().nullable(),
        item_type: z.enum(["PRODUCT", "SERVICE", "SUBSCRIPTION"]).optional(),
        cost_price: z.union([z.number(), z.string()]).optional().nullable(),
        sale_price: z.union([z.number(), z.string()]).optional().nullable(),
        duration_minutes: z.number().optional().nullable(),
        billing_type: z.string().optional().nullable(),
        brand: z.string().optional().nullable(),
        grouping: z.string().optional().nullable(),
        power: z.string().optional().nullable(),
        size: z.string().optional().nullable(),
        supplier: z.string().optional().nullable(),
        status: z.string().optional().nullable(),
        specs: z.string().optional().nullable(),
      })
      .passthrough();

    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

    try {
      const companyId = await resolveProductsCompanyId(req);
      const payload: Record<string, unknown> = { ...parsed.data };
      if (payload.cost_price !== undefined) payload.cost_price = parseMoney(payload.cost_price);
      if (payload.sale_price !== undefined) payload.sale_price = parseMoney(payload.sale_price);
      payload.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .update(payload)
        .eq("id", id)
        .eq("company_id", companyId)
        .select("*")
        .maybeSingle();

      if (error) return respondWithProductsError(res, error, "Update product error");
      if (!data) return res.status(404).json({ error: "Product not found" });
      return res.json(data);
    } catch (error) {
      return respondWithProductsError(res, error, "Update product error");
    }
  });

  app.delete("/api/products/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    try {
      const companyId = await resolveProductsCompanyId(req);
      const { data, error } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .delete()
        .eq("id", id)
        .eq("company_id", companyId)
        .select("id")
        .maybeSingle();

      if (error) return respondWithProductsError(res, error, "Delete product error");
      if (!data) return res.status(404).json({ error: "Product not found" });
      return res.status(204).send();
    } catch (error) {
      return respondWithProductsError(res, error, "Delete product error");
    }
  });

  app.post("/api/products/bulk-upsert", requireAuth, async (req: any, res) => {
    console.log("[BULK-UPSERT] Iniciando importação...");
    const items = (req.body || []) as any[];
    if (!Array.isArray(items)) return res.status(400).json({ error: "Body deve ser array" });
    console.log("[BULK-UPSERT] Total de itens recebidos:", items.length);

    const schema = z.object({
      external_id: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      sku: z.string().optional().nullable(),
      unit: z.string().optional().nullable(),
      item_type: z.enum(["PRODUCT", "SERVICE", "SUBSCRIPTION"]).optional(),
      cost_price: z.union([z.number(), z.string()]).optional().nullable(),
      sale_price: z.union([z.number(), z.string()]).optional().nullable(),
      duration_minutes: z.number().optional().nullable(),
      billing_type: z.string().optional().nullable(),
      brand: z.string().optional().nullable(),
      grouping: z.string().optional().nullable(),
      power: z.string().optional().nullable(),
      size: z.string().optional().nullable(),
      supplier: z.string().optional().nullable(),
      status: z.string().optional().nullable(),
      specs: z.string().optional().nullable(),
    });

    const nowIso = new Date().toISOString();
    const toUpsert: Record<string, unknown>[] = [];
    for (const raw of items) {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        console.error("[BULK-UPSERT] Item inválido:", raw, "Erro:", parsed.error.format());
        return res.status(400).json({ error: "Item inválido", details: parsed.error.format() });
      }
      const r = parsed.data as any;
      toUpsert.push({
        external_id: String(r.external_id).toLowerCase(), // Normalizar para lowercase
        name: r.name,
        description: r.description ?? null,
        sku: r.sku ?? null,
        unit: r.unit ?? null,
        item_type: r.item_type ?? "PRODUCT", // Padrão PRODUCT
        cost_price: parseMoney(r.cost_price),
        sale_price: parseMoney(r.sale_price),
        duration_minutes: r.duration_minutes ?? null,
        billing_type: r.billing_type ?? null,
        brand: r.brand ?? null,
        grouping: r.grouping ?? null,
        power: r.power ?? null,
        size: r.size ?? null,
        supplier: r.supplier ?? null,
        status: r.status ?? null,
        specs: r.specs ?? null,
        is_active: true, // Todos ativos por padrão
        updated_at: nowIso,
      });
    }

    try {
      const companyId = await resolveProductsCompanyId(req);
      console.log("[BULK-UPSERT] Company ID:", companyId);
      console.log("[BULK-UPSERT] Tabela sendo usada:", PRODUCTS_TABLE);
      
      // Buscar IDs existentes para fazer upsert manual
      const externalIds = toUpsert.map(item => item.external_id);
      console.log("[BULK-UPSERT] Buscando produtos existentes para:", externalIds.slice(0, 5), "...");
      const { data: existing } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .select("id, external_id")
        .eq("company_id", companyId)
        .in("external_id", externalIds);

      console.log("[BULK-UPSERT] Produtos existentes encontrados:", (existing || []).length);
      const existingMap = new Map((existing || []).map((e: any) => [e.external_id, e.id]));
      
      const toInsert: any[] = [];
      const toUpdate: any[] = [];
      
      for (const item of toUpsert) {
        const itemWithCompany = { ...item, company_id: companyId };
        const existingId = existingMap.get(item.external_id);
        
        if (existingId) {
          toUpdate.push({ ...itemWithCompany, id: existingId });
        } else {
          toInsert.push(itemWithCompany);
        }
      }
      
      let affectedCount = 0;
      
      console.log("[BULK-UPSERT] Inserir novos:", toInsert.length, "| Atualizar existentes:", toUpdate.length);
      
      // Inserir novos
      if (toInsert.length > 0) {
        console.log("[BULK-UPSERT] Inserindo novos itens...");
        const { data: inserted, error: insertError } = await supabaseAdmin
          .from(PRODUCTS_TABLE)
          .insert(toInsert)
          .select("*");
        
        if (insertError) {
          console.error("[BULK-UPSERT] Erro ao inserir:", insertError);
          return respondWithProductsError(res, insertError, "Bulk insert error");
        }
        affectedCount += (inserted || []).length;
        console.log("[BULK-UPSERT] Inseridos com sucesso:", (inserted || []).length);
      }
      
      // Atualizar existentes
      if (toUpdate.length > 0) {
        console.log("[BULK-UPSERT] Atualizando itens existentes...");
      }
      for (const item of toUpdate) {
        const { id, ...updateData } = item;
        const { error: updateError } = await supabaseAdmin
          .from(PRODUCTS_TABLE)
          .update(updateData)
          .eq("id", id)
          .eq("company_id", companyId);
        
        if (updateError) {
          console.error("[BULK-UPSERT] Erro ao atualizar item:", id, updateError);
        } else {
          affectedCount++;
        }
      }

      console.log("[BULK-UPSERT] ✅ Concluído! Total afetado:", affectedCount);
      return res.json({ upserted: affectedCount });
    } catch (error) {
      console.error("[BULK-UPSERT] ❌ Erro geral:", error);
      return respondWithProductsError(res, error, "Bulk upsert error");
    }
  });
}
