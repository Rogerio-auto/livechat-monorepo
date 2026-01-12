import type { Application } from "express";
import { z } from "zod";

import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAdmin } from "../lib/supabase.js";

const PRODUCTS_TABLE = "catalog_items";

// Esquema comum para validação de produto
const productSchema = z.object({
  external_id: z.string().optional().nullable(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  unit: z.string().nullable().optional(),
  item_type: z.enum(["PRODUCT", "SERVICE", "SUBSCRIPTION"]).optional().default("PRODUCT"),
  images: z.array(z.string()).max(10).optional().default([]),
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
  is_active: z.boolean().optional().default(true),
}).passthrough();

function parseMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;

  // Se tem vírgula, provavelmente é formato brasileiro (1.234,56 ou 1234,56)
  let normalized = value.trim();
  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  
  const numeric = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isNaN(numeric) ? null : numeric;
}

function respondWithProductsError(res: any, error: any, fallback: string) {
  console.error(`[Products Error] ${fallback}:`, error);
  const status = error?.status || 500;
  const message = error?.message || error?.details || String(error) || fallback;
  return res.status(status).json({ error: message });
}

function getCompanyId(req: any): string {
  const companyId = req.user?.company_id;
  if (!companyId) {
    const err: any = new Error("Usuário sem empresa associada ou contexto não encontrado");
    err.status = 403;
    throw err;
  }
  return companyId;
}

export function registerProductRoutes(app: Application) {
  app.get("/api/products/stats", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      
      const { data, error } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .select("status, sale_price, grouping")
        .eq("company_id", companyId);

      if (error) throw error;

      const items = data || [];
      const stats = {
        total: items.length,
        active: items.filter((p: any) => p.status !== "Esgotado" && p.status !== "Inativo").length,
        totalValue: items.reduce((acc: number, p: any) => acc + (Number(p.sale_price) || 0), 0),
        categoriesCount: new Set(items.map((p: any) => p.grouping).filter(Boolean)).size,
      };

      return res.json(stats);
    } catch (error) {
      return respondWithProductsError(res, error, "Products stats error");
    }
  });

  app.get("/api/products", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const q = (req.query.q as string | undefined)?.trim();
      const status = (req.query.status as string | undefined)?.trim();
      const grouping = (req.query.grouping as string | undefined)?.trim();
      const supplier = (req.query.supplier as string | undefined)?.trim();
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      let supabaseQuery = supabaseAdmin
        .from(PRODUCTS_TABLE)
        .select("*", { count: "exact" })
        .eq("company_id", companyId)
        .order("name", { ascending: true });

      if (q) {
        supabaseQuery = supabaseQuery.or(`name.ilike.%${q}%,sku.ilike.%${q}%,brand.ilike.%${q}%,external_id.ilike.%${q}%`);
      }
      
      if (status && status.toLowerCase() !== "all") {
        supabaseQuery = supabaseQuery.eq("status", status);
      }
      
      if (grouping) {
        supabaseQuery = supabaseQuery.eq("grouping", grouping);
      }
      
      if (supplier) {
        supabaseQuery = supabaseQuery.eq("supplier", supplier);
      }

      if (typeof limit === "number") {
        supabaseQuery = supabaseQuery.range(offset, offset + limit - 1);
      }

      const { data, error, count } = await supabaseQuery;
      if (error) throw error;
      
      return res.json({ items: data || [], total: count ?? (data?.length || 0) });
    } catch (error) {
      return respondWithProductsError(res, error, "Products list error");
    }
  });

  app.get("/api/products/:id", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const { id } = req.params as { id: string };

      const { data, error } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .select("*")
        .eq("id", id)
        .eq("company_id", companyId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Produto não encontrado" });

      return res.json(data);
    } catch (error) {
      return respondWithProductsError(res, error, "Get product error");
    }
  });

  app.post("/api/products", requireAuth, async (req: any, res) => {
    try {
      const companyId = getCompanyId(req);
      const parsed = productSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const payload: Record<string, unknown> = { ...parsed.data };
      delete payload.image_url; // Evita erro se a coluna não existir no DB
      
      if (payload.cost_price !== undefined) payload.cost_price = parseMoney(payload.cost_price);
      if (payload.sale_price !== undefined) payload.sale_price = parseMoney(payload.sale_price);
      
      payload.company_id = companyId;
      if (!payload.updated_at) payload.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .insert([payload])
        .select("*")
        .single();

      if (error) throw error;
      return res.status(201).json(data);
    } catch (error) {
      return respondWithProductsError(res, error, "Create product error");
    }
  });

  app.put("/api/products/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    try {
      const companyId = getCompanyId(req);
      const parsed = productSchema.partial().safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

      const payload: Record<string, unknown> = { ...parsed.data };
      delete payload.image_url; // Evita erro se a coluna não existir no DB
      
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

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Produto não encontrado" });
      return res.json(data);
    } catch (error) {
      return respondWithProductsError(res, error, "Update product error");
    }
  });

  app.delete("/api/products/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params as { id: string };
    try {
      const companyId = getCompanyId(req);
      const { data, error } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .delete()
        .eq("id", id)
        .eq("company_id", companyId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: "Produto não encontrado" });
      return res.status(204).send();
    } catch (error) {
      return respondWithProductsError(res, error, "Delete product error");
    }
  });

  app.post("/api/products/bulk-upsert", requireAuth, async (req: any, res) => {
    const items = (req.body || []) as any[];
    if (!Array.isArray(items)) return res.status(400).json({ error: "Body deve ser array" });

    try {
      const companyId = getCompanyId(req);
      const nowIso = new Date().toISOString();
      
      const toUpsert: any[] = [];
      for (const raw of items) {
        const parsed = productSchema.safeParse(raw);
        if (!parsed.success) continue; 
        
        const r = { ...parsed.data };
        delete (r as any).image_url;

        toUpsert.push({
          ...r,
          company_id: companyId,
          external_id: r.external_id ? String(r.external_id).toLowerCase() : null,
          cost_price: parseMoney(r.cost_price),
          sale_price: parseMoney(r.sale_price),
          updated_at: nowIso
        });
      }

      if (toUpsert.length === 0) {
        return res.json({ upserted: 0 });
      }

      // Tenta upsert direto (requer constraint de unicidade no DB: company_id, external_id)
      const { data, error } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .upsert(toUpsert, { 
          onConflict: "company_id, external_id",
          ignoreDuplicates: false 
        })
        .select("id");

      if (error) {
        console.warn("[BULK-UPSERT] Direto falhou:", error.message);
        // Fallback manual se a constraint não existir
        const externalIds = toUpsert.map(item => item.external_id).filter(Boolean);
        const { data: existing } = await supabaseAdmin
          .from(PRODUCTS_TABLE)
          .select("id, external_id")
          .eq("company_id", companyId)
          .in("external_id", externalIds);

        const existingMap = new Map((existing || []).map((e: any) => [e.external_id, e.id]));
        
        let affectedCount = 0;
        const batchSize = 20;
        
        for (let i = 0; i < toUpsert.length; i += batchSize) {
          const batch = toUpsert.slice(i, i + batchSize);
          const promises = batch.map(async (item) => {
            const existingId = existingMap.get(item.external_id);
            if (existingId) {
              const { error: err } = await supabaseAdmin
                .from(PRODUCTS_TABLE)
                .update(item)
                .eq("id", existingId)
                .eq("company_id", companyId);
              if (!err) affectedCount++;
            } else {
              const { data: ins, error: err } = await supabaseAdmin
                .from(PRODUCTS_TABLE)
                .insert([item])
                .select("id");
              if (!err && ins) affectedCount++;
            }
          });
          await Promise.all(promises);
        }
        return res.json({ upserted: affectedCount });
      }

      return res.json({ upserted: (data || []).length });
    } catch (error) {
      return respondWithProductsError(res, error, "Bulk upsert error");
    }
  });
}
