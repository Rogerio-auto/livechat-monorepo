// backend/src/services/agents.runtime.ts
import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase.ts";
import { decryptSecret } from "../lib/crypto.ts";
import type { AgentRow } from "../repos/agents.repo.ts";
import { getActiveAgentForInbox, getAgent as repoGetAgent } from "../repos/agents.repo.ts";
import { listAgentTools } from "../repos/tools.repo.ts";
import { executeTool, type ToolExecutionContext } from "./toolHandlers.ts";
import { getAgentContext, appendMultipleToContext } from "./agentContext.ts";
import { db } from "../pg.ts";

export type ChatTurn = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_call_id?: string; name?: string };

/**
 * Processa mensagens de mídia (áudio/imagem) para extrair conteúdo textual
 */
async function processMediaMessage(opts: {
  chatId: string;
  userMessage: string;
  agent: AgentRow;
  apiKey: string;
}): Promise<string> {
  try {
    // Buscar última mensagem com mídia do chat
    const mediaMsg = await db.oneOrNone<{
      type: string | null;
      media_url: string | null;
    }>(
      `SELECT type, media_url 
       FROM public.chat_messages 
       WHERE chat_id = $1 AND is_from_customer = true AND media_url IS NOT NULL
       ORDER BY created_at DESC 
       LIMIT 1`,
      [opts.chatId]
    );

    if (!mediaMsg || !mediaMsg.media_url) {
      return opts.userMessage;
    }

    const messageType = (mediaMsg.type || "").toUpperCase();
    const client = new OpenAI({ apiKey: opts.apiKey });

    // Transcrição de áudio
    if (messageType === "AUDIO" && opts.agent.transcription_model) {
      try {
        const audioUrl = mediaMsg.media_url;
        // Baixar áudio
        const response = await fetch(audioUrl);
        if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
        
        const audioBuffer = await response.arrayBuffer();
        const audioFile = new File([audioBuffer], "audio.ogg", { type: "audio/ogg" });

        const transcription = await client.audio.transcriptions.create({
          file: audioFile,
          model: opts.agent.transcription_model,
          language: "pt",
        });

        const transcribedText = transcription.text || "";
        console.log("[agents][transcription] Audio transcribed", {
          chatId: opts.chatId,
          length: transcribedText.length,
        });

        return opts.userMessage 
          ? `${opts.userMessage}\n\n[Áudio transcrito]: ${transcribedText}`
          : `[Áudio transcrito]: ${transcribedText}`;
      } catch (error) {
        console.error("[agents][transcription] Failed to transcribe audio:", error);
        return opts.userMessage;
      }
    }

    // Análise de imagem
    if (messageType === "IMAGE" && opts.agent.vision_model) {
      try {
        const imageUrl = mediaMsg.media_url;
        
        const visionResponse = await client.chat.completions.create({
          model: opts.agent.vision_model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: opts.userMessage || "Descreva esta imagem em detalhes.",
                },
                {
                  type: "image_url",
                  image_url: { url: imageUrl },
                },
              ],
            },
          ],
          max_tokens: 500,
        });

        const description = visionResponse.choices[0]?.message?.content || "";
        console.log("[agents][vision] Image analyzed", {
          chatId: opts.chatId,
          length: description.length,
        });

        return opts.userMessage
          ? `${opts.userMessage}\n\n[Imagem analisada]: ${description}`
          : `[Imagem analisada]: ${description}`;
      } catch (error) {
        console.error("[agents][vision] Failed to analyze image:", error);
        return opts.userMessage;
      }
    }

    return opts.userMessage;
  } catch (error) {
    console.error("[agents][processMedia] Error processing media:", error);
    return opts.userMessage;
  }
}

/**
 * Verifica se o agente deve responder baseado nas configurações de inbox e tipo de chat
 */
export async function shouldAgentRespond(
  agent: AgentRow,
  inboxId: string,
  chatId: string
): Promise<{ allowed: boolean; reason?: string }> {
  // 1. Verificar se inbox está habilitada para este agente
  const enabledInboxes = agent.enabled_inbox_ids || [];
  if (enabledInboxes.length > 0 && !enabledInboxes.includes(inboxId)) {
    return { allowed: false, reason: "Inbox not enabled for this agent" };
  }

  // 2. Verificar se é grupo e se agente ignora grupos
  if (agent.ignore_group_messages) {
    try {
      const chat = await db.oneOrNone<{ kind: string | null; chat_type: string | null }>(
        `SELECT kind, chat_type FROM chats WHERE id = $1`,
        [chatId]
      );

      if (chat && (chat.kind === "GROUP" || chat.chat_type === "GROUP")) {
        return { allowed: false, reason: "Agent ignores group messages" };
      }
    } catch (error) {
      console.error("[shouldAgentRespond] Error checking chat type:", error);
      // Em caso de erro, permite por segurança
      return { allowed: true };
    }
  }

  return { allowed: true };
}

export async function getAgent(companyId: string, agentId: string | null | undefined): Promise<AgentRow | null> {
  if (agentId) return await repoGetAgent(companyId, agentId);
  return await getActiveAgentForInbox(companyId);
}

async function getOpenAISecretForCompany(companyId: string, integrationId?: string | null): Promise<{ apiKey: string; defaultModel: string | null }> {
  // Prioriza integração específica se fornecida
  if (integrationId) {
    const { data, error } = await supabaseAdmin
      .from("integrations_openai")
      .select("id, company_id, api_key_enc, default_model, is_active")
      .eq("company_id", companyId)
      .eq("id", integrationId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.api_key_enc) {
      const apiKey = decryptSecret((data as any).api_key_enc) || "";
      if (!apiKey) throw new Error("OpenAI API key not configured for this integration");
      return { apiKey, defaultModel: (data as any)?.default_model ?? null };
    }
  }
  // Busca uma integração ativa da empresa
  const { data: row } = await supabaseAdmin
    .from("integrations_openai")
    .select("id, api_key_enc, default_model, is_active")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (row?.api_key_enc) {
    const apiKey = decryptSecret((row as any).api_key_enc) || "";
    if (!apiKey) throw new Error("OpenAI API key not configured for company");
    return { apiKey, defaultModel: (row as any)?.default_model ?? null };
  }
  // Fallback em env (mantém compatibilidade)
  const envKey = process.env.OPENAI_API_KEY || "";
  if (!envKey) throw new Error("OPENAI_API_KEY não configurada");
  return { apiKey: envKey, defaultModel: process.env.OPENAI_MODEL || null };
}

function buildPrompt(agent: AgentRow | null, contextHistory: ChatTurn[], userMessage: string): ChatTurn[] {
  const sysParts: string[] = [];
  if (agent?.description) sysParts.push(String(agent.description));
  if (agent?.model_params && typeof agent.model_params === "object") {
    try {
      const rules = JSON.stringify(agent.model_params);
      sysParts.push(`Instrucoes do agente: ${rules}`);
    } catch {}
  }
  const system: ChatTurn = { role: "system", content: sysParts.join("\n\n").trim() || "Você é um atendente útil, breve e educado." };
  
  // Limitar histórico Redis aos últimos 12 turnos (excluindo system)
  const recentHistory = contextHistory.filter(t => t.role !== "system").slice(-12);
  
  const finalUser: ChatTurn = { role: "user", content: userMessage };
  return [system, ...recentHistory, finalUser];
}

export async function runAgentReply(opts: {
  companyId: string;
  inboxId?: string | null;
  agentId?: string | null;
  userMessage: string;
  chatId: string;
  contactId?: string;
  userId?: string;
}): Promise<{ reply: string; usage?: any; agentId?: string | null; model?: string; skipped?: boolean; reason?: string }>
{
  const agent = await getAgent(opts.companyId, opts.agentId);
  if (!agent) throw new Error("Nenhum agente ativo/configurado para esta empresa/inbox");

  // VALIDAÇÃO: Verificar se há integração OpenAI configurada
  if (!agent.integration_openai_id) {
    console.log(`[agent] Agente ${agent.id} sem integration_openai_id configurada`);
    return {
      reply: "",
      skipped: true,
      reason: "Agente sem integração OpenAI configurada",
      agentId: agent.id,
    };
  }

  // VALIDAÇÃO: Verificar se agente deve responder nesta inbox e tipo de chat
  if (opts.inboxId && opts.chatId) {
    const validation = await shouldAgentRespond(agent, opts.inboxId, opts.chatId);
    if (!validation.allowed) {
      console.log(`[agent] Not responding in chat ${opts.chatId}: ${validation.reason}`);
      return { 
        reply: "", 
        skipped: true, 
        reason: validation.reason,
        agentId: agent.id 
      };
    }
  }

  const { apiKey, defaultModel } = await getOpenAISecretForCompany(opts.companyId, agent.integration_openai_id ?? undefined);

  const model = (agent.model || defaultModel || process.env.OPENAI_MODEL || "gpt-4o-mini").toString();
  const temperature = typeof agent.model_params?.temperature === "number" ? agent.model_params.temperature : 0.2;
  const maxTokens = typeof agent.model_params?.max_tokens === "number" ? agent.model_params.max_tokens : 1024;

  const client = new OpenAI({ apiKey });

  // PROCESSAMENTO DE MÍDIA: Transcrição de áudio e análise de imagem
  const processedMessage = await processMediaMessage({
    chatId: opts.chatId,
    userMessage: opts.userMessage,
    agent,
    apiKey,
  });

  // 1. Buscar contexto do Redis
  const contextHistory = await getAgentContext(opts.chatId);

  // 2. Construir mensagens iniciais (usando mensagem processada com mídia)
  const messages = buildPrompt(agent, contextHistory, processedMessage);

  // 3. Buscar ferramentas habilitadas do agente
  const agentTools = await listAgentTools({ agent_id: agent.id, is_enabled: true });
  const tools: any[] | undefined = agentTools.length > 0 ? agentTools.map(at => at.tool.schema) : undefined;

  // 4. Context para toolHandlers
  const toolContext: ToolExecutionContext = {
    agentId: agent.id,
    chatId: opts.chatId,
    contactId: opts.contactId,
    userId: opts.userId,
    companyId: opts.companyId, // Add companyId for knowledge base queries
  };

  // 5. Loop de function calling
  let resp = await client.chat.completions.create({
    model,
    messages: messages as any,
    tools,
    temperature,
    max_tokens: maxTokens,
  });

  let iterations = 0;
  const MAX_ITERATIONS = 5;

  while (resp.choices[0]?.finish_reason === 'tool_calls' && iterations < MAX_ITERATIONS) {
    iterations++;
    const toolCalls = resp.choices[0].message.tool_calls as any[];
    if (!toolCalls || toolCalls.length === 0) break;

    // Adicionar mensagem do assistente ao histórico
    messages.push({
      role: "assistant",
      content: resp.choices[0].message.content || "",
      ...resp.choices[0].message as any
    });

    // Executar cada tool call
    const toolResults = await Promise.all(
      toolCalls.map(async (tc: any) => {
        const tool = agentTools.find(at => at.tool.key === tc.function.name);
        if (!tool) {
          return {
            tool_call_id: tc.id,
            role: "tool" as const,
            content: JSON.stringify({ error: `Tool '${tc.function.name}' not found or not enabled` })
          };
        }

        try {
          const params = JSON.parse(tc.function.arguments);
          const result = await executeTool(tool.tool, tool, params, toolContext);
          return {
            tool_call_id: tc.id,
            role: "tool" as const,
            content: JSON.stringify(result)
          };
        } catch (error: any) {
          return {
            tool_call_id: tc.id,
            role: "tool" as const,
            content: JSON.stringify({ error: error.message || String(error) })
          };
        }
      })
    );

    // Adicionar resultados ao histórico
    messages.push(...toolResults as any);

    // Continuar conversa
    resp = await client.chat.completions.create({
      model,
      messages: messages as any,
      tools,
      temperature,
      max_tokens: maxTokens,
    });
  }

  const reply = resp.choices[0]?.message?.content || '';

  // 6. Salvar contexto atualizado no Redis
  const newTurns: ChatTurn[] = [
    { role: "user", content: opts.userMessage },
    { role: "assistant", content: reply }
  ];
  await appendMultipleToContext(opts.chatId, newTurns);

  return { reply, usage: resp.usage ?? undefined, agentId: agent.id, model };
}
