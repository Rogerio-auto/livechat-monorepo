// services/agentContext.ts
// Gerenciamento de contexto (memória curta) do agente usando Redis

import { getRedis } from "../lib/redis.js";
import type { ChatTurn } from "./agents-runtime.service.js";

const CONTEXT_TTL = 3600; // 1 hora
const MAX_TURNS = 20; // máximo de turnos mantidos no contexto

export async function getAgentContext(chatId: string): Promise<ChatTurn[]> {
  const redis = getRedis();
  if (!redis) return [];

  const key = `agent:context:${chatId}`;
  const raw = await redis.get(key);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAgentContext(chatId: string, context: ChatTurn[]): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  // Manter apenas os últimos MAX_TURNS
  const trimmed = context.slice(-MAX_TURNS);

  const key = `agent:context:${chatId}`;
  await redis.setex(key, CONTEXT_TTL, JSON.stringify(trimmed));
}

export async function appendToContext(chatId: string, turn: ChatTurn): Promise<ChatTurn[]> {
  const context = await getAgentContext(chatId);
  context.push(turn);
  await saveAgentContext(chatId, context);
  return context;
}

export async function appendMultipleToContext(chatId: string, turns: ChatTurn[]): Promise<ChatTurn[]> {
  const context = await getAgentContext(chatId);
  context.push(...turns);
  await saveAgentContext(chatId, context);
  return context;
}

export async function clearAgentContext(chatId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const key = `agent:context:${chatId}`;
  await redis.del(key);
}
