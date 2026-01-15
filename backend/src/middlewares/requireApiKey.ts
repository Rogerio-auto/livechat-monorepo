import { Response, NextFunction } from "express";
import crypto from "node:crypto";
import db from "../pg.js";
import { AuthRequest } from "../types/express.js";

/**
 * Middleware para autenticação via API Key (X-API-Key)
 * Usado para integrações externas e webhooks.
 */
export async function requireApiKey(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = req.header("X-API-Key") || 
                 req.header("x-api-key") || 
                 (req.header("Authorization")?.startsWith("Bearer ") ? req.header("Authorization")?.slice(7) : null);

  if (!apiKey) {
    return res.status(401).json({ error: "API Key ausente. Use o header X-API-Key." });
  }

  try {
    // 1. Gerar o hash da chave recebida (SHA-256)
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    // 2. Buscar no banco a chave ativa
    // Usamos pg (db) para ser mais performático em autenticação recorrente
    const apiKeyRow = await db.oneOrNone(
      `SELECT id, company_id, key_prefix, scopes, is_active 
       FROM public.api_keys 
       WHERE key_hash = $1 AND is_active = true`,
      [keyHash]
    );

    if (!apiKeyRow) {
      return res.status(401).json({ error: "API Key inválida ou inativa." });
    }

    // 3. Injetar contexto no request para compatibilidade com outros middlewares e controllers
    req.user = {
      id: `api_key_${apiKeyRow.id}`, // Identificador virtual
      company_id: apiKeyRow.company_id,
      role: "API_INTEGRATOR",
      name: `API Key: ${apiKeyRow.key_prefix}***`
    };

    // Algumas rotas dependem de profile.role
    req.profile = {
      role: "ADMIN", // Damos privilégios de admin para requisições de API por padrão ou fixamos scope
      company_id: apiKeyRow.company_id,
      scopes: apiKeyRow.scopes
    };

    // 4. Atualizar last_used_at em background (não bloqueia a resposta)
    db.none("UPDATE public.api_keys SET last_used_at = now() WHERE id = $1", [apiKeyRow.id]).catch(() => {});

    return next();
  } catch (error) {
    console.error("[requireApiKey] Erro ao validar chave:", error);
    return res.status(500).json({ error: "Erro interno ao validar API Key." });
  }
}
