import express from "express";
import { z } from "zod";
import { requireAuth } from "../middlewares/requireAuth.js";
import { supabaseAnon, supabaseAdmin } from "../lib/supabase.js";
import { JWT_COOKIE_NAME, JWT_COOKIE_SECURE, JWT_COOKIE_DOMAIN } from "../config/env.js";
import { getIO } from "../lib/io.js";
import { sendPasswordResetEmail, sendPasswordChangedEmail } from "../services/emailService.js";
import crypto, { randomUUID } from "crypto";
import { redis } from "../lib/redis.js";
import { logger } from "../lib/logger.js";

const AuthSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
});

export function registerAuthRoutes(app: express.Application) {
  console.log('[AUTH ROUTES] 🚀 Registering auth routes - VERSION 2.0');
  
  // Sign up
  app.post("/signup", async (req, res, next) => {
    try {
      const { email, password } = AuthSchema.parse(req.body);
      
      logger.info(`[AUTH] Tentativa de cadastro: ${email}`);
      
      const { data, error } = await supabaseAnon.auth.signUp({ email, password });
      if (error) {
        logger.error(`[AUTH] Erro no cadastro: ${email}`, { error: error.message });
        return res.status(400).json({ error: error.message });
      }
      
      return res.status(201).json({ ok: true, user: data.user });
    } catch (error) {
      next(error);
    }
  });

  // Login
  app.post("/login", async (req, res, next) => {
    try {
      const { email, password } = AuthSchema.parse(req.body);
      
      logger.info(`[AUTH] Tentativa de login: ${email}`);
      
      const { data, error } = await supabaseAnon.auth.signInWithPassword({ email, password });
      if (error || !data?.session) {
        logger.warn(`[AUTH] Falha no login: ${email}`);
        return res.status(401).json({ error: "Credenciais inválidas" });
      }
      
      const accessToken = data.session.access_token;
      res.cookie(JWT_COOKIE_NAME, accessToken, {
        httpOnly: true,
        secure: JWT_COOKIE_SECURE,
        sameSite: "lax",
        domain: JWT_COOKIE_DOMAIN,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      
      logger.info(`[AUTH] Login bem-sucedido: ${email}`);
      return res.json({ ok: true, user: data.user });
    } catch (error) {
      next(error);
    }
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
    const companyId = user.company_id || profile.company_id;

    // Buscar indústria da empresa
    let industry = null;
    if (companyId) {
      const { data: company } = await supabaseAdmin
        .from("companies")
        .select("industry")
        .eq("id", companyId)
        .single();
      industry = company?.industry;
    }
    
    const response = { 
      id: user.id || profile.id,
      email: user.email || profile.email,
      role: profile.role || "USER",
      company_id: companyId,
      industry: industry, // ✅ Adicionado nicho da empresa
      name: user.name || profile.name || "", // ✅ Removido fallback para email para não confundir o usuário
      avatarUrl: user.avatar || profile.avatar || null,
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
        let token: string | undefined;
        const authHeader = req.headers.authorization;
        
        // Tentar pegar token do header Authorization
        if (authHeader?.startsWith("Bearer ")) {
          token = authHeader.slice(7);
        }
        
        // Se não encontrou no header, tentar pegar do cookie
        if (!token) {
          token = (req as any).cookies?.jwt;
        }
        
        if (token && token !== "undefined") {
          const tokenHash = Buffer.from(token).toString("base64").slice(0, 32);
          const cacheKey = `auth:token:${tokenHash}`;
          await redis.del(cacheKey);
          console.log('[/auth/me/theme] ✅ Cache invalidated:', cacheKey);
        } else {
          console.warn('[/auth/me/theme] ⚠️ No token found to invalidate cache');
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
        let token: string | undefined;
        const authHeader = req.headers.authorization;
        
        // Tentar pegar token do header Authorization
        if (authHeader?.startsWith("Bearer ")) {
          token = authHeader.slice(7);
        }
        
        // Se não encontrou no header, tentar pegar do cookie
        if (!token) {
          token = (req as any).cookies?.jwt;
        }
        
        if (token && token !== "undefined") {
          const tokenHash = Buffer.from(token).toString("base64").slice(0, 32);
          const cacheKey = `auth:token:${tokenHash}`;
          await redis.del(cacheKey);
          console.log('[/auth/me/phone] ✅ Cache invalidated:', cacheKey);
        } else {
          console.warn('[/auth/me/phone] ⚠️ No token found to invalidate cache');
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
      name: urow?.name || req.user.name || "",
      role: urow?.role || null,
      avatarUrl: urow?.avatar || req.user.avatar || null,
      companyId: urow?.company_id || null,
      companyName,
    });
  });

  // Update authenticated user's profile
  app.put("/me/profile", requireAuth, async (req: any, res) => {
    try {
      const authUserId = req.user.id as string;
      const authEmail = (req.user.email || req.profile?.email) as string;
      
      console.log(`[PUT /me/profile] Request from user: ${authUserId} (${authEmail})`);

      const schema = z
        .object({
          name: z.string().min(1).optional(),
          avatarUrl: z.string().optional(), // Removido .url() para permitir strings vazias ou caminhos relativos
          currentPassword: z.string().optional(),
          newPassword: z.string().optional(),
          confirmPassword: z.string().optional(),
        })
        .passthrough();
      
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) {
        console.warn("[PUT /me/profile] Validation failed:", parsed.error.format());
        return res.status(400).json({ error: "Dados inválidos", details: parsed.error.format() });
      }
      
      const body = parsed.data as any;
      const nowIso = new Date().toISOString();
      let updatedRow: any = null;
      const toUpdate: Record<string, any> = {};
      
      if (typeof body.name === "string") toUpdate.name = body.name;
      if (typeof body.avatarUrl === "string") toUpdate.avatar = body.avatarUrl;
      
      if (Object.keys(toUpdate).length > 0) {
        toUpdate.updated_at = nowIso;
        console.log("[PUT /me/profile] Updating users table:", toUpdate);
        
        // Tenta atualizar usando as mesmas colunas de busca do requireAuth
        const { data, error } = await supabaseAdmin
          .from("users")
          .update(toUpdate)
          .or(`user_id.eq.${authUserId},id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
          .select("user_id, name, role, avatar, company_id")
          .maybeSingle();
          
        if (error) {
          console.error("[PUT /me/profile] DB Update Error:", error);
          return res.status(500).json({ error: error.message });
        }
        updatedRow = data;
        console.log("[PUT /me/profile] DB Update Success:", updatedRow?.user_id);
      }

      let passwordChanged = false;
      const hasPwChange = typeof body.newPassword === "string" && body.newPassword.length > 0;
      
      if (hasPwChange) {
        console.log(`[PUT /me/profile] 🔐 Password change requested`);
        
        if (!authEmail) {
          console.error(`[PUT /me/profile] ❌ Cannot change password: User email is missing`);
          return res.status(400).json({ error: "E-mail do usuário não encontrado. Não é possível validar a senha atual." });
        }

        if (!body.currentPassword) {
          return res.status(400).json({ error: "Senha atual é obrigatória para definir uma nova senha." });
        }
        
        if (body.newPassword !== body.confirmPassword) {
          return res.status(400).json({ error: "A nova senha e a confirmação não coincidem." });
        }
        
        // Validate current password by trying to sign in
        console.log(`[PUT /me/profile] Validating current password for ${authEmail}...`);
        const { data: login, error: loginErr } = await supabaseAnon.auth.signInWithPassword({
          email: authEmail,
          password: String(body.currentPassword),
        });
        
        if (loginErr || !login?.session) {
          console.warn(`[PUT /me/profile] ❌ Current password validation failed:`, loginErr?.message);
          return res.status(400).json({ error: "Senha atual incorreta." });
        }
        
        console.log(`[PUT /me/profile] ✅ Current password validated.`);

        // Update password using admin
        const { error: upwErr } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
          password: String(body.newPassword),
        });
        
        if (upwErr) {
          console.error(`[PUT /me/profile] ❌ Admin API Error:`, upwErr.message);
          return res.status(500).json({ error: "Erro ao atualizar senha no Supabase: " + upwErr.message });
        }
        
        console.log(`[PUT /me/profile] ✨ Password updated successfully.`);
        passwordChanged = true;
      }

      const resp = {
        id: authUserId,
        email: authEmail,
        name: updatedRow?.name ?? req.user.name ?? "",
        role: updatedRow?.role ?? null,
        avatarUrl: updatedRow?.avatar ?? req.user.avatar ?? null,
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

      // ✅ Invalidar cache de autenticação para forçar refresh do nome/avatar no middleware
      try {
        let token: string | undefined;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith("Bearer ")) {
          token = authHeader.slice(7);
        }
        if (!token) {
          token = (req as any).cookies?.jwt;
        }
        if (token && token !== "undefined") {
          const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
          const cacheKey = `auth:token:${tokenHash}`;
          await redis.del(cacheKey);
          console.log('[PUT /me/profile] ✅ Cache invalidated:', cacheKey);
        }
      } catch (cacheError) {
        console.warn('[PUT /me/profile] Failed to invalidate cache:', cacheError);
      }

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
