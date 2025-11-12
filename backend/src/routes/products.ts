import type { Application } from "express";
import { z } from "zod";

import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || "catalog_items";

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
          unit: z.string().nullable().optional(),
          cost_price: z.union([z.number(), z.string()]).nullable().optional(),
          sale_price: z.union([z.number(), z.string()]).nullable().optional(),
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
      payload.company_id = companyId;

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
        name: z.string().optional(),
        unit: z.string().nullable().optional(),
        cost_price: z.union([z.number(), z.string()]).nullable().optional(),
        sale_price: z.union([z.number(), z.string()]).nullable().optional(),
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
    const items = (req.body || []) as any[];
    if (!Array.isArray(items)) return res.status(400).json({ error: "Body deve ser array" });

    const schema = z.object({
      external_id: z.string().min(1),
      name: z.string().min(1),
      unit: z.string().optional().nullable(),
      cost_price: z.union([z.number(), z.string()]).optional().nullable(),
      sale_price: z.union([z.number(), z.string()]).optional().nullable(),
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
        return res.status(400).json({ error: "Item inválido", details: parsed.error.format() });
      }
      const r = parsed.data as any;
      toUpsert.push({
        external_id: String(r.external_id),
        name: r.name,
        unit: r.unit ?? null,
        cost_price: parseMoney(r.cost_price),
        sale_price: parseMoney(r.sale_price),
        brand: r.brand ?? null,
        grouping: r.grouping ?? null,
        power: r.power ?? null,
        size: r.size ?? null,
        supplier: r.supplier ?? null,
        status: r.status ?? null,
        specs: r.specs ?? null,
        updated_at: nowIso,
      });
    }

    try {
      const companyId = await resolveProductsCompanyId(req);
      const payload = toUpsert.map((item) => ({ ...item, company_id: companyId }));

      const { data, error } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .upsert(payload, { onConflict: "external_id" })
        .select("*");

      if (error) return respondWithProductsError(res, error, "Bulk upsert error");
      const affected = (data || []).filter((row: any) => row?.company_id === companyId).length;
      return res.json({ upserted: affected });
    } catch (error) {
      return respondWithProductsError(res, error, "Bulk upsert error");
    }
  });
}
