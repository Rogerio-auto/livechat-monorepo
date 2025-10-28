import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAdmin } from "../lib/supabase.ts";

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || "products";

const parseMoney = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const s = v.replace(/\./g, "").replace(/,/, ".").replace(/[^0-9.-]/g, "");
  const n = Number(s);
  return isNaN(n) ? null : n;
};

export function registerProductRoutes(app: express.Application) {
  // List products
  app.get("/products", requireAuth, async (req, res) => {
    try {
      const q = (req.query.q as string | undefined)?.trim();
      const status = (req.query.status as string | undefined)?.trim();
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      let query = supabaseAdmin
        .from(PRODUCTS_TABLE)
        .select("*", { count: "exact" })
        .order("updated_at", { ascending: false });

      if (q) query = query.ilike("name", `%${q}%`);
      if (status && status.toLowerCase() !== "all") query = query.eq("status", status);
      if (typeof limit === "number" && typeof offset === "number") {
        query = query.range(offset, offset + Math.max(0, limit - 1));
      }

      const { data, error, count } = await query;
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ items: data || [], total: count ?? (data?.length || 0) });
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Products list error" });
    }
  });

  // Create product
  app.post("/products", requireAuth, async (req, res) => {
    try {
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

      const payload: any = { ...parsed.data };
      if (payload.cost_price !== undefined) payload.cost_price = parseMoney(payload.cost_price);
      if (payload.sale_price !== undefined) payload.sale_price = parseMoney(payload.sale_price);

      const { data, error } = await supabaseAdmin
        .from(PRODUCTS_TABLE)
        .insert([payload])
        .select("*")
        .single();
      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json(data);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Create product error" });
    }
  });

  // Update product
  app.put("/products/:id", requireAuth, async (req, res) => {
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

    const payload: any = { ...parsed.data };
    if (payload.cost_price !== undefined) payload.cost_price = parseMoney(payload.cost_price);
    if (payload.sale_price !== undefined) payload.sale_price = parseMoney(payload.sale_price);
    payload.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from(PRODUCTS_TABLE)
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.json(data);
  });

  // Delete product
  app.delete("/products/:id", requireAuth, async (req, res) => {
    const { id } = req.params as { id: string };
    const { error } = await supabaseAdmin.from(PRODUCTS_TABLE).delete().eq("id", id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).send();
  });

  // Bulk upsert
  app.post("/products/bulk-upsert", requireAuth, async (req, res) => {
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

    const toUpsert: any[] = [];
    for (const raw of items) {
      const parsed = schema.safeParse(raw);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ error: "Item inválido", details: parsed.error.format() });
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
        updated_at: new Date().toISOString(),
      });
    }

    const { data, error } = await supabaseAdmin
      .from(PRODUCTS_TABLE)
      .upsert(toUpsert, { onConflict: "external_id" })
      .select("*");
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ upserted: data?.length || 0 });
  });
}
