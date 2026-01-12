import type { Response, NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabase.js";

/**
 * Middleware que verifica se o usuário autenticado tem acesso a pelo menos uma inbox.
 * Se não tiver vínculo em inbox_users, retorna 403.
 */
export async function requireInboxAccess(req: any, res: Response, next: NextFunction) {
  try {
    const authUserId = req.user?.id;
    if (!authUserId) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    // Buscar o registro em public.users pelo user_id do Supabase Auth
    const { data: userRow, error: userError } = await supabaseAdmin
      .from("users")
      .select("id, role")
      .eq("user_id", authUserId)
      .maybeSingle();

    if (userError) {
      console.error("[requireInboxAccess] Error fetching user:", userError);
      return res.status(500).json({ error: "Erro ao verificar usuário" });
    }

    if (!userRow) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const localUserId = userRow.id;
    const role = (userRow.role || "").toString().toUpperCase();

    // ADMIN e MANAGER sempre tem acesso (bypass)
    if (role === "ADMIN" || role === "MANAGER" || role === "SUPER_ADMIN") {
      req.hasInboxAccess = true;
      return next();
    }

    // Verificar se tem pelo menos 1 vínculo em inbox_users
    const { data: links, error: linksError } = await supabaseAdmin
      .from("inbox_users")
      .select("id")
      .eq("user_id", localUserId)
      .limit(1);

    if (linksError) {
      console.error("[requireInboxAccess] Error checking inbox_users:", linksError);
      return res.status(500).json({ error: "Erro ao verificar acesso às inboxes" });
    }

    if (!links || links.length === 0) {
      return res.status(403).json({ 
        error: "Sem acesso ao livechat",
        reason: "Você não está vinculado a nenhuma caixa de entrada. Contate o administrador."
      });
    }

    // Tem acesso
    req.hasInboxAccess = true;
    next();
  } catch (error: any) {
    console.error("[requireInboxAccess] Unexpected error:", error);
    return res.status(500).json({ error: "Erro ao verificar acesso" });
  }
}
