import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.ts";
import { supabaseAnon, supabaseAdmin } from "../lib/supabase.ts";
import { JWT_COOKIE_NAME, JWT_COOKIE_SECURE, JWT_COOKIE_DOMAIN } from "../config/env.ts";
import { getIO } from "../lib/io.ts";
import { sendPasswordResetEmail, sendPasswordChangedEmail } from "../services/emailService.js";
import { randomUUID } from "crypto";
import { redis } from "../lib/redis.ts";

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
    console.log('[AUTH] 🚪 Logout request received');
    
    // Limpar cookie principal de autenticação
    res.clearCookie(JWT_COOKIE_NAME, { 
      path: "/",
      domain: JWT_COOKIE_DOMAIN,
      httpOnly: true,
      secure: JWT_COOKIE_SECURE,
      sameSite: "lax"
    });
    
    // Limpar outros cookies potenciais
    res.clearCookie('refresh_token', { path: "/" });
    res.clearCookie('session', { path: "/" });
    
    console.log('[AUTH] ✅ Cookies cleared successfully');
    return res.json({ ok: true, message: 'Logged out successfully' });
  });

  app.get("/auth/me", requireAuth, async (req: any, res) => {
    console.log('[/auth/me] 🎯 ENDPOINT CALLED - NEW VERSION');
    console.log('[/auth/me] 📦 req.user:', req.user);
    console.log('[/auth/me] 👤 req.profile:', req.profile);
    
    const user = req.user || {};
    const profile = req.profile || {};
    
    const response = { 
      id: user.id || profile.id,
      email: user.email || profile.email,
      role: profile.role || "USER",
      company_id: user.company_id || profile.company_id,
      name: profile.name || user.name || user.email,
      phone: profile.phone || user.phone || null,
      theme_preference: profile.theme_preference || "system", // ✅ Já vem do cache do requireAuth
      requires_phone_setup: !profile.phone && !user.phone, // ✅ Flag indicando se precisa configurar telefone
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

      // ✅ Invalidar cache de autenticação para forçar refresh
      try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.slice(7);
          const tokenHash = Buffer.from(token).toString("base64").slice(0, 32);
          const cacheKey = `auth:token:${tokenHash}`;
          await redis.del(cacheKey);
          console.log('[/auth/me/theme] Cache invalidated:', cacheKey);
        }
      } catch (cacheError) {
        console.warn('[/auth/me/theme] Failed to invalidate cache:', cacheError);
      }

      return res.json({ ok: true, theme_preference });
    } catch (e: any) {
      console.error('[/auth/me/theme] Error:', e);
      return res.status(500).json({ error: e?.message || "theme update error" });
    }
  });

  // Update phone number
  app.patch("/auth/me/phone", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const { phone } = req.body || {};
      
      if (!phone || typeof phone !== "string" || phone.trim().length === 0) {
        return res.status(400).json({ error: "Telefone é obrigatório" });
      }

      // Validar formato básico (apenas números, pode ter +, -, espaços, parênteses)
      const phoneClean = phone.replace(/[\s\-\(\)]/g, '');
      if (!/^\+?[0-9]{10,15}$/.test(phoneClean)) {
        return res.status(400).json({ error: "Formato de telefone inválido. Use apenas números com DDD (ex: +5511999999999)" });
      }

      const { error } = await supabaseAdmin
        .from("users")
        .update({ phone: phoneClean })
        .eq("user_id", authUserId);

      if (error) {
        console.error('[/auth/me/phone] Error updating phone:', error);
        return res.status(500).json({ error: error.message });
      }

      // ✅ Invalidar cache de autenticação para forçar refresh
      try {
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          const token = authHeader.slice(7);
          const tokenHash = Buffer.from(token).toString("base64").slice(0, 32);
          const cacheKey = `auth:token:${tokenHash}`;
          await redis.del(cacheKey);
          console.log('[/auth/me/phone] Cache invalidated:', cacheKey);
        }
      } catch (cacheError) {
        console.warn('[/auth/me/phone] Failed to invalidate cache:', cacheError);
      }

      return res.json({ ok: true, phone: phoneClean });
    } catch (e: any) {
      console.error('[/auth/me/phone] Error:', e);
      return res.status(500).json({ error: e?.message || "phone update error" });
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

  // Request password reset
  app.post("/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body || {};
      
      if (!email) {
        return res.status(400).json({ error: "Email é obrigatório" });
      }

      // Buscar usuário pelo email
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.listUsers();
      
      if (authError) {
        console.error('[forgot-password] Error listing users:', authError);
        // Por segurança, sempre retornar sucesso mesmo se o usuário não existir
        return res.json({ 
          ok: true, 
          message: "Se o email existir em nossa base, você receberá instruções para redefinir sua senha." 
        });
      }

      const user = authUser.users.find((u) => u.email === email);
      
      if (!user) {
        // Por segurança, não revelar se o email existe ou não
        return res.json({ 
          ok: true, 
          message: "Se o email existir em nossa base, você receberá instruções para redefinir sua senha." 
        });
      }

      // Buscar nome do usuário
      const { data: userData } = await supabaseAdmin
        .from("users")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();

      // Gerar token único
      const resetToken = randomUUID();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

      // Salvar token no banco
      const { error: insertError } = await supabaseAdmin
        .from("password_reset_tokens")
        .insert({
          user_id: user.id,
          token: resetToken,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) {
        console.error('[forgot-password] Error saving token:', insertError);
        return res.status(500).json({ error: "Erro ao processar solicitação" });
      }

      // Enviar email
      const emailResult = await sendPasswordResetEmail(
        email,
        resetToken,
        userData?.name || email.split('@')[0]
      );

      if (!emailResult.success) {
        console.error('[forgot-password] Error sending email:', emailResult.error);
        return res.status(500).json({ error: "Erro ao enviar email de recuperação" });
      }

      return res.json({ 
        ok: true, 
        message: "Se o email existir em nossa base, você receberá instruções para redefinir sua senha." 
      });
    } catch (e: any) {
      console.error('[forgot-password] Error:', e);
      return res.status(500).json({ error: e?.message || "Erro ao processar solicitação" });
    }
  });

  // Verify reset token
  app.get("/auth/verify-reset-token/:token", async (req, res) => {
    try {
      const { token } = req.params;

      if (!token) {
        return res.status(400).json({ error: "Token é obrigatório" });
      }

      // Buscar token no banco
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("password_reset_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenError || !tokenData) {
        return res.status(400).json({ error: "Token inválido" });
      }

      // Verificar se o token já foi usado
      if (tokenData.used_at) {
        return res.status(400).json({ error: "Token já foi utilizado" });
      }

      // Verificar se o token expirou
      if (new Date(tokenData.expires_at) < new Date()) {
        return res.status(400).json({ error: "Token expirado" });
      }

      return res.json({ ok: true, valid: true });
    } catch (e: any) {
      console.error('[verify-reset-token] Error:', e);
      return res.status(500).json({ error: e?.message || "Erro ao verificar token" });
    }
  });

  // Reset password with token
  app.post("/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword, confirmPassword, phone } = req.body || {};

      if (!token || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: "Todos os campos são obrigatórios" });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "As senhas não coincidem" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "A senha deve ter no mínimo 6 caracteres" });
      }

      // Validar telefone se fornecido
      if (phone) {
        const phoneClean = String(phone).replace(/\D/g, '');
        if (phoneClean.length < 10 || phoneClean.length > 15) {
          return res.status(400).json({ error: "Formato de telefone inválido" });
        }
      }

      // Buscar token no banco
      const { data: tokenData, error: tokenError } = await supabaseAdmin
        .from("password_reset_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenError || !tokenData) {
        return res.status(400).json({ error: "Token inválido" });
      }

      // Verificar se o token já foi usado
      if (tokenData.used_at) {
        return res.status(400).json({ error: "Token já foi utilizado" });
      }

      // Verificar se o token expirou
      if (new Date(tokenData.expires_at) < new Date()) {
        return res.status(400).json({ error: "Token expirado. Solicite um novo link de recuperação." });
      }

      // Atualizar senha do usuário
      const { error: updateError } = await (supabaseAdmin as any).auth.admin.updateUserById(
        tokenData.user_id,
        { password: newPassword }
      );

      if (updateError) {
        console.error('[reset-password] Error updating password:', updateError);
        return res.status(500).json({ error: "Erro ao atualizar senha" });
      }

      // Atualizar telefone se fornecido
      if (phone) {
        const phoneClean = String(phone).replace(/\D/g, '');
        const { error: phoneError } = await supabaseAdmin
          .from("users")
          .update({ phone: phoneClean })
          .eq("user_id", tokenData.user_id);

        if (phoneError) {
          console.error('[reset-password] Error updating phone:', phoneError);
          // Não bloquear se falhar ao atualizar telefone
        }
      }

      // Marcar token como usado
      await supabaseAdmin
        .from("password_reset_tokens")
        .update({ used_at: new Date().toISOString() })
        .eq("token", token);

      // Buscar email e nome do usuário para enviar confirmação
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(tokenData.user_id);
      
      if (authUser?.user?.email) {
        const { data: userData } = await supabaseAdmin
          .from("users")
          .select("name")
          .eq("user_id", tokenData.user_id)
          .maybeSingle();

        // Enviar email de confirmação (não bloquear a resposta se falhar)
        sendPasswordChangedEmail(
          authUser.user.email,
          userData?.name || authUser.user.email.split('@')[0]
        ).catch((e) => console.error('[reset-password] Error sending confirmation email:', e));
      }

      return res.json({ 
        ok: true, 
        message: "Senha alterada com sucesso! Você já pode fazer login com sua nova senha." 
      });
    } catch (e: any) {
      console.error('[reset-password] Error:', e);
      return res.status(500).json({ error: e?.message || "Erro ao redefinir senha" });
    }
  });
}
