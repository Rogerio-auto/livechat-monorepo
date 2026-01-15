// src/services/meta/oauth.service.ts
import { logger } from "../../lib/logger.js";

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface MetaExchangeTokenResult {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface MetaPhoneNumber {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: string;
}

export interface MetaWabaInfo {
  id: string;
  name: string;
  currency: string;
  timezone_id: string;
}

/**
 * Troca o 'code' recebido do Embedded Signup por um access_token.
 */
export async function exchangeCodeForToken(code: string): Promise<MetaExchangeTokenResult> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID ou META_APP_SECRET não configurados.");
  }

  const url = new URL(`${GRAPH_URL}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("code", code);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    logger.error("[META][OAUTH] Falha na troca do code", data);
    throw new Error(data.error?.message || "Falha na troca do code");
  }

  return data;
}

/**
 * Troca um short-lived token por um long-lived token.
 * Nota: Para WhatsApp Embedded Signup, às vezes o token já vem com a duração necessária, 
 * mas a troca garante a persistência de 60 dias (ou vitalício para System Users).
 */
export async function exchangeMetaToken(shortLivedToken: string): Promise<MetaExchangeTokenResult> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("META_APP_ID ou META_APP_SECRET não configurados no ambiente do servidor.");
  }

  const url = new URL(`${GRAPH_URL}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortLivedToken);

  const response = await fetch(url.toString());
  const data = await response.json();

  if (!response.ok) {
    logger.error("[META][OAUTH] Falha na troca de token", data);
    throw new Error(data?.error?.message || "Erro ao trocar token da Meta");
  }

  return data as MetaExchangeTokenResult;
}

/**
 * Busca os números de telefone vinculados a uma WhatsApp Business Account (WABA)
 */
export async function fetchWabaPhoneNumbers(wabaId: string, accessToken: string): Promise<MetaPhoneNumber[]> {
  const url = `${GRAPH_URL}/${wabaId}/phone_numbers`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error("[META][OAUTH] Falha ao buscar números da WABA", data);
    throw new Error(data?.error?.message || "Erro ao buscar números da Meta");
  }

  return (data.data || []) as MetaPhoneNumber[];
}

/**
 * Busca detalhes de uma WABA para confirmar acesso e capturar nome
 */
export async function fetchWabaDetails(wabaId: string, accessToken: string): Promise<MetaWabaInfo> {
  const url = `${GRAPH_URL}/${wabaId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error("[META][OAUTH] Falha ao buscar detalhes da WABA", data);
    throw new Error(data?.error?.message || "Erro ao buscar detalhes da WABA na Meta");
  }

  return data as MetaWabaInfo;
}

/**
 * Busca todas as WABAs que o token tem permissão para gerenciar.
 */
export async function fetchAllowedWabas(accessToken: string): Promise<MetaWabaInfo[]> {
  const url = `${GRAPH_URL}/me/whatsapp_business_accounts`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error("[META][OAUTH] Falha ao buscar WABAs permitidas", data);
    throw new Error(data?.error?.message || "Erro ao buscar WABAs na Meta");
  }

  return (data.data || []) as MetaWabaInfo[];
}
