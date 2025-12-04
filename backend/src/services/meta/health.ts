// src/services/meta/health.ts
import { getDecryptedCredsForInbox } from "./store.js";
import { supabaseAdmin } from "../../lib/supabase.js";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaAccountHealth {
  phone_number_id: string;
  display_phone_number: string;
  quality_rating: "GREEN" | "YELLOW" | "RED" | "UNKNOWN";
  messaging_limit_tier: "TIER_1K" | "TIER_10K" | "TIER_100K" | "TIER_UNLIMITED" | "UNKNOWN";
  tier_limit: number;
  name_status?: string;
  code_verification_status?: string;
}

const TIER_LIMITS: Record<string, number> = {
  "TIER_1K": 1000,
  "TIER_10K": 10000,
  "TIER_100K": 100000,
  "TIER_UNLIMITED": 1000000, // Soft cap
  "UNKNOWN": 100, // Ultra conservador
};

/**
 * Busca status de saúde da conta Meta (quality rating, tier, limites)
 */
export async function fetchMetaAccountHealth(inboxId: string): Promise<MetaAccountHealth> {
  const creds = await getDecryptedCredsForInbox(inboxId);
  
  if (!creds.phone_number_id) {
    throw new Error("Inbox não possui phone_number_id configurado");
  }

  const url = `${GRAPH}/${creds.phone_number_id}?fields=quality_rating,messaging_limit_tier,display_phone_number,name_status,code_verification_status`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${creds.access_token}`,
    },
  });

  const json = await response.json();

  if (!response.ok) {
    const code = (json as any)?.error?.code || response.status;
    const message = (json as any)?.error?.message || response.statusText;
    throw new Error(`[Meta Health] ${code}: ${message}`);
  }

  const qualityRating = (json.quality_rating as string)?.toUpperCase() || "UNKNOWN";
  const tier = (json.messaging_limit_tier as string) || "UNKNOWN";
  const tierLimit = TIER_LIMITS[tier] || 100;

  return {
    phone_number_id: creds.phone_number_id,
    display_phone_number: json.display_phone_number || "",
    quality_rating: qualityRating as any,
    messaging_limit_tier: tier as any,
    tier_limit: tierLimit,
    name_status: json.name_status,
    code_verification_status: json.code_verification_status,
  };
}

/**
 * Atualiza health status no banco de dados
 */
export async function updateInboxHealthStatus(inboxId: string): Promise<MetaAccountHealth> {
  const health = await fetchMetaAccountHealth(inboxId);

  const { error } = await supabaseAdmin
    .from("inboxes")
    .update({
      meta_quality_rating: health.quality_rating,
      meta_messaging_tier: health.messaging_limit_tier,
      meta_tier_limit: health.tier_limit,
      meta_health_updated_at: new Date().toISOString(),
    })
    .eq("id", inboxId);

  if (error) {
    console.error(`[Meta Health] Erro ao atualizar inbox ${inboxId}:`, error);
    throw new Error(error.message);
  }

  console.log(`[Meta Health] ✅ Inbox ${inboxId} atualizada:`, {
    quality: health.quality_rating,
    tier: health.messaging_limit_tier,
    limit: health.tier_limit,
  });

  return health;
}

/**
 * Verifica se inbox está saudável para enviar campanhas
 */
export async function isInboxHealthy(inboxId: string): Promise<{
  healthy: boolean;
  reason?: string;
  quality_rating: string;
  tier: string;
  tier_limit: number;
}> {
  const { data: inbox } = await supabaseAdmin
    .from("inboxes")
    .select("meta_quality_rating, meta_messaging_tier, meta_tier_limit, meta_health_updated_at")
    .eq("id", inboxId)
    .single();

  if (!inbox) {
    return { 
      healthy: false, 
      reason: "Inbox não encontrada", 
      quality_rating: "UNKNOWN", 
      tier: "UNKNOWN",
      tier_limit: 100
    };
  }

  // Se nunca foi atualizado, buscar agora
  if (!inbox.meta_health_updated_at) {
    try {
      const health = await updateInboxHealthStatus(inboxId);
      return {
        healthy: health.quality_rating !== "RED",
        reason: health.quality_rating === "RED" ? "Quality rating RED - conta em risco" : undefined,
        quality_rating: health.quality_rating,
        tier: health.messaging_limit_tier,
        tier_limit: health.tier_limit,
      };
    } catch (error) {
      return { 
        healthy: false, 
        reason: "Erro ao buscar health status", 
        quality_rating: "UNKNOWN", 
        tier: "UNKNOWN",
        tier_limit: 100
      };
    }
  }

  // Atualizar se estiver desatualizado (>1 hora)
  const updatedAt = new Date(inbox.meta_health_updated_at);
  const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceUpdate > 1) {
    try {
      await updateInboxHealthStatus(inboxId);
      // Re-fetch updated data
      const { data: updatedInbox } = await supabaseAdmin
        .from("inboxes")
        .select("meta_quality_rating, meta_messaging_tier, meta_tier_limit")
        .eq("id", inboxId)
        .single();
      
      if (updatedInbox) {
        inbox.meta_quality_rating = updatedInbox.meta_quality_rating;
        inbox.meta_messaging_tier = updatedInbox.meta_messaging_tier;
        inbox.meta_tier_limit = updatedInbox.meta_tier_limit;
      }
    } catch (error) {
      console.warn(`[Meta Health] Falha ao atualizar health (usando cache):`, error);
    }
  }

  const isRed = inbox.meta_quality_rating === "RED";
  return {
    healthy: !isRed,
    reason: isRed ? "Quality rating RED - campanhas bloqueadas" : undefined,
    quality_rating: inbox.meta_quality_rating || "UNKNOWN",
    tier: inbox.meta_messaging_tier || "UNKNOWN",
    tier_limit: inbox.meta_tier_limit || 100,
  };
}

/**
 * Busca tier limit de uma inbox
 */
export async function getInboxTierLimit(inboxId: string): Promise<number> {
  const { data: inbox } = await supabaseAdmin
    .from("inboxes")
    .select("meta_tier_limit, meta_health_updated_at")
    .eq("id", inboxId)
    .single();

  if (!inbox) return 100;

  // Se nunca foi atualizado ou está desatualizado (>24h), atualizar
  if (!inbox.meta_health_updated_at) {
    try {
      const health = await updateInboxHealthStatus(inboxId);
      return health.tier_limit;
    } catch (error) {
      console.warn(`[Meta Health] Erro ao buscar tier limit:`, error);
      return inbox.meta_tier_limit || 100;
    }
  }

  const updatedAt = new Date(inbox.meta_health_updated_at);
  const hoursSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60);
  
  if (hoursSinceUpdate > 24) {
    try {
      const health = await updateInboxHealthStatus(inboxId);
      return health.tier_limit;
    } catch (error) {
      console.warn(`[Meta Health] Erro ao atualizar tier limit:`, error);
    }
  }

  return inbox.meta_tier_limit || 100;
}
