import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAnon, supabaseAdmin } from "../lib/supabase.ts";
import { JWT_COOKIE_NAME, JWT_COOKIE_SECURE, JWT_COOKIE_DOMAIN } from "../config/env.ts";
import { getIO } from "../lib/io.ts";

export function registerAuthRoutes(app: express.Application) {
  console.log('[AUTH ROUTES] 🚀 Registering auth routes - VERSION 2.0');
  
  // Sign up
  app.post("/signup", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });
    const { data, error } = await supabaseAnon.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(201).json({ ok: true, user: data.user });
  });

  // Login
  app.post("/login", async (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) return res.status(400).json({ error: "Email e senha são obrigatórios" });
    const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
    if (error || !data?.session) return res.status(401).json({ error: "Credenciais inválidas" });
    const accessToken = data.session.access_token;
    res.cookie(JWT_COOKIE_NAME, accessToken, {
      httpOnly: true,
      secure: JWT_COOKIE_SECURE,
      sameSite: "lax",
      domain: JWT_COOKIE_DOMAIN,
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.json({ ok: true, user: data.user });
  });

  app.post("/logout", (_req, res) => {
    res.clearCookie(JWT_COOKIE_NAME, { 
      path: "/",
      domain: JWT_COOKIE_DOMAIN 
    });
    return res.json({ ok: true });
  });

  app.get("/auth/me", requireAuth, async (req: any, res) => {
    console.log('[/auth/me] 🎯 ENDPOINT CALLED - NEW VERSION');
    console.log('[/auth/me] 📦 req.user:', req.user);
    console.log('[/auth/me] 👤 req.profile:', req.profile);
    
    const user = req.user || {};
    const profile = req.profile || {};
    
    // Buscar preferência de tema do banco
    let theme_preference = "system";
    try {
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("theme_preference")
        .eq("user_id", user.id || profile.id)
        .maybeSingle();
      
      if (userData?.theme_preference) {
        theme_preference = userData.theme_preference;
      }
    } catch (e) {
      console.error('[/auth/me] Error fetching theme preference:', e);
    }
    
    const response = { 
      id: user.id || profile.id,
      email: user.email || profile.email,
      role: profile.role || "USER",
      company_id: user.company_id || profile.company_id,
      name: profile.name || user.name || user.email,
      theme_preference,
    };
    
    console.log('[/auth/me] 📤 Response:', response);
    
    return res.json(response);
  });

  // Update theme preference
  app.patch("/auth/me/theme", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { theme_preference } = req.body || {};
      
      if (!theme_preference || !["light", "dark", "system"].includes(theme_preference)) {
        return res.status(400).json({ error: "Preferência de tema inválida. Use 'light', 'dark' ou 'system'" });
      }

      const { error } = await supabaseAdmin
        .from("users")
        .update({ theme_preference })
        .eq("user_id", authUserId);

      if (error) {
        console.error('[/auth/me/theme] Error updating theme:', error);
        return res.status(500).json({ error: error.message });
      }

      return res.json({ ok: true, theme_preference });
    } catch (e: any) {
      console.error('[/auth/me/theme] Error:', e);
      return res.status(500).json({ error: e?.message || "theme update error" });
    }
  });

  // Profile of authenticated user + company basics
  app.get("/me/profile", requireAuth, async (req: any, res) => {
    const userId = req.user.id;
    const { data: urow, error: uerr } = await supabaseAdmin
      .from("users")
      .select("user_id, name, role, avatar, company_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (uerr) return res.status(500).json({ error: uerr.message });

    let companyName: string | null = null;
    try {
      if (urow?.company_id) {
        const { data: comp, error: cerr } = await supabaseAdmin
          .from("companies")
          .select("id, name")
          .eq("id", urow.company_id)
          .maybeSingle();
        if (!cerr) companyName = (comp as any)?.name ?? null;
      }
    } catch {}

    return res.json({
      id: req.user.id,
      email: req.user.email,
      name: urow?.name || req.user.email,
      role: urow?.role || null,
      avatarUrl: urow?.avatar || null,
      companyId: urow?.company_id || null,
      companyName,
    });
  });

  // Update authenticated user's profile
  app.put("/me/profile", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const authEmail = req.user.email as string;
      const schema = z
        .object({
          name: z.string().min(1).optional(),
          avatarUrl: z.string().url().optional(),
          currentPassword: z.string().optional(),
          newPassword: z.string().optional(),
          confirmPassword: z.string().optional(),
        })
        .passthrough();
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success)
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      const body = parsed.data as any;

      const nowIso = new Date().toISOString();
      let updatedRow: any = null;
      const toUpdate: Record<string, any> = {};
      if (typeof body.name === "string") toUpdate.name = body.name;
      if (typeof body.avatarUrl === "string") toUpdate.avatar = body.avatarUrl;
      if (Object.keys(toUpdate).length > 0) {
        toUpdate.updated_at = nowIso;
        const { data, error } = await supabaseAdmin
          .from("users")
          .update(toUpdate)
          .eq("user_id", authUserId)
          .select("user_id, name, role, avatar, company_id")
          .maybeSingle();
        if (error) return res.status(500).json({ error: error.message });
        updatedRow = data;
      }

      let passwordChanged = false;
      const hasPwChange = typeof body.newPassword === "string" && body.newPassword.length > 0;
      if (hasPwChange) {
        if (!body.currentPassword) return res.status(400).json({ error: "Senha atual é obrigatória" });
        if (body.newPassword !== body.confirmPassword)
          return res.status(400).json({ error: "Confirmação de senha não confere" });
        const { data: login, error: loginErr } = await supabaseAnon.auth.signInWithPassword({
          email: authEmail,
          password: String(body.currentPassword),
        });
        if (loginErr || !login?.session) return res.status(400).json({ error: "Senha atual inválida" });
        const { error: upwErr } = await (supabaseAdmin as any).auth.admin.updateUserById(authUserId, {
          password: String(body.newPassword),
        });
        if (upwErr) return res.status(500).json({ error: upwErr.message });
        passwordChanged = true;
      }

      const resp = {
        id: authUserId,
        email: authEmail,
        name: updatedRow?.name ?? req.user.email,
        role: updatedRow?.role ?? null,
        avatarUrl: updatedRow?.avatar ?? null,
        companyId: updatedRow?.company_id ?? null,
        passwordChanged,
      };

      try {
        getIO()?.emit("profile:updated", {
          userId: authUserId,
          changes: { name: toUpdate.name, avatarUrl: toUpdate.avatar },
          profile: resp,
        });
      } catch {}
      return res.json(resp);
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "profile update error" });
    }
  });
}
