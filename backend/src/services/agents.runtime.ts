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

function buildPrompt(agent: AgentRow | null, contextHistory: ChatTurn[], userMessage: string, tools?: any[]): ChatTurn[] {
  const sysParts: string[] = [];
  if (agent?.description) sysParts.push(String(agent.description));
  if (agent?.model_params && typeof agent.model_params === "object") {
    try {
      const rules = JSON.stringify(agent.model_params);
      sysParts.push(`Instrucoes do agente: ${rules}`);
    } catch {}
  }
  
  // Instrução de segurança para erros de ferramentas
  sysParts.push("SYSTEM NOTE: Se o resultado de uma ferramenta (tool) for um erro (ex: HTTP 404, JSON error, Internal Error), NÃO tente solucionar esse erro técnico com o usuário. Apenas peça desculpas e diga que houve uma falha interna ao processar o pedido.");

  // Política de uso de ferramentas (Forçar uso de interatividade)
  sysParts.push(`
IMPORTANT TOOL USAGE POLICY:
1. ALWAYS check if a tool is available to perform the action before writing a text response.
2. If a tool exists to send a specific type of message (like interactive buttons, lists, or templates), YOU MUST USE THE TOOL instead of describing the options in text.
3. Do not ask for permission to use a tool if the user's intent implies it (e.g., if they need to choose an option, send the options button immediately).
4. When using a tool, do not write a text message explaining what you are doing unless necessary. Let the tool's output speak for itself.
`.trim());

  // Injetar descrições das ferramentas disponíveis para reforçar o uso
  if (tools && tools.length > 0) {
    const toolDescriptions = tools.map((t: any) => `- ${t.tool.key}: ${t.tool.description || t.tool.name}`).join("\n");
    sysParts.push(`AVAILABLE TOOLS:\n${toolDescriptions}\n\nREMINDER: You must use these tools whenever applicable.`);
    
    // Instrução específica para botões
    if (tools.some((t: any) => t.tool.key === 'send_interactive_buttons')) {
      sysParts.push("SPECIFIC INSTRUCTION: You have access to 'send_interactive_buttons'. Use it whenever you need to offer choices to the user (e.g., menu options, yes/no questions). Do NOT write lists in text.");
    }
    // Instrução específica para listas
    if (tools.some((t: any) => t.tool.key === 'send_interactive_list')) {
      sysParts.push("SPECIFIC INSTRUCTION: You have access to 'send_interactive_list'. Use it whenever you need to offer a menu or a list of options to the user. Do NOT write lists in text.");
    }
  }

  // Regra de exceção para formatos de saída JSON (conflito comum)
  sysParts.push(`
CRITICAL EXCEPTION FOR OUTPUT FORMAT:
If your instructions mention a specific JSON output format (like {"message": [...]}), YOU MUST IGNORE THAT FORMAT when calling a tool.
- If you use a tool: DO NOT output JSON text. Just generate the tool call.
- If you reply with text: Follow the required JSON format.
`.trim());

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
  leadId?: string;
  userId?: string;
}): Promise<{ reply: string; usage?: any; agentId?: string | null; model?: string; skipped?: boolean; reason?: string }>
{
  const callId = `${opts.chatId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  console.log("[AGENT][RUNTIME] 🚀 runAgentReply called", {
    callId,
    chatId: opts.chatId,
    companyId: opts.companyId,
    agentId: opts.agentId,
    inboxId: opts.inboxId,
    messageLength: opts.userMessage?.length || 0,
  });

  const agent = await getAgent(opts.companyId, opts.agentId);
  if (!agent) {
    console.warn("[AGENT][RUNTIME] ❌ No active agent found", { callId, companyId: opts.companyId });
    throw new Error("Nenhum agente ativo/configurado para esta empresa/inbox");
  }

  console.log("[AGENT][RUNTIME] ✅ Agent loaded", {
    callId,
    agentId: agent.id,
    agentName: agent.name,
    hasOpenAIIntegration: !!agent.integration_openai_id,
  });

  // VALIDAÇÃO: Verificar se há integração OpenAI configurada
  if (!agent.integration_openai_id) {
    console.log(`[AGENT][RUNTIME] ⏭️  Agent ${agent.id} without OpenAI integration`, { callId });
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
      console.log(`[AGENT][RUNTIME] ⏭️  Not responding in chat ${opts.chatId}: ${validation.reason}`, { callId });
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

  // 2. Buscar ferramentas habilitadas do agente
  const agentTools = await listAgentTools({ agent_id: agent.id, is_enabled: true });

  // 3. Construir mensagens iniciais (usando mensagem processada com mídia)
  const messages = buildPrompt(agent, contextHistory, processedMessage, agentTools);

  // Converter tools do nosso catálogo (schema = parâmetros) para o formato da OpenAI (type=function)
  function normalizeParametersSchema(raw: any): any | undefined {
    try {
      // Se for string, tenta fazer parse
      let schema = raw;
      if (typeof raw === "string") {
        try {
          schema = JSON.parse(raw);
        } catch (e) {
          console.warn("[AGENT][RUNTIME] Failed to parse tool schema JSON", { raw });
        }
      }

      // Already a valid JSON Schema object
      if (schema && typeof schema === "object") {
        // Case: mistakenly stored full OpenAI tool object
        if (schema.type === "function" && schema.function && typeof schema.function === "object") {
          const p = (schema.function as any).parameters;
          return p && typeof p === "object" ? p : { type: "object", properties: {} };
        }
        // Case: mistakenly stored { parameters: {...} }
        if (schema.parameters && typeof schema.parameters === "object" && !schema.type) {
          return schema.parameters;
        }
        // If it has a top-level 'function' field by mistake
        if (schema.function && typeof schema.function === "object" && schema.function.parameters) {
          return schema.function.parameters;
        }
        // Ensure it is an object schema
        if (schema.type === "object" || schema.properties || schema.required) {
          return { type: "object", additionalProperties: true, ...schema };
        }
      }
      // Fallback: allow any object
      return { type: "object", additionalProperties: true };
    } catch {
      return { type: "object", additionalProperties: true };
    }
  }

  function stripCustomerIdIfCustomersUpdate(parameters: any, at: any): any {
    try {
      const isCustomersUpdate = at?.tool?.handler_type === "INTERNAL_DB"
        && at?.tool?.handler_config?.table === "customers"
        && at?.tool?.handler_config?.action === "update";
      if (!isCustomersUpdate || !parameters || typeof parameters !== "object") return parameters;
      const p = { ...parameters };
      if (p.properties && typeof p.properties === "object") {
        p.properties = { ...p.properties };
        delete p.properties.customer_id;
      }
      if (Array.isArray(p.required)) {
        p.required = p.required.filter((r: any) => r !== "customer_id");
      }
      if (!p.type) p.type = "object";
      return p;
    } catch { return parameters; }
  }

  const tools: any[] | undefined = agentTools.length > 0
    ? agentTools.map(at => {
        const base = normalizeParametersSchema(at.tool.schema);
        const parameters = stripCustomerIdIfCustomersUpdate(base, at);
        
        // Log para debug
        console.log(`[AGENT][RUNTIME] Tool definition for ${at.tool.key}:`, JSON.stringify(parameters));

        return {
          type: "function",
          function: {
            name: at.tool.key,
            description: at.tool.description || at.tool.name || undefined,
            parameters,
          }
        };
      })
    : undefined;

  // 4. Context para toolHandlers
  const toolContext: ToolExecutionContext = {
    agentId: agent.id,
    chatId: opts.chatId,
    contactId: opts.contactId,
    leadId: opts.leadId,
    userId: opts.userId,
    companyId: opts.companyId, // Add companyId for knowledge base queries
  };

  // 5. Loop de function calling
  // Array para armazenar os novos turnos gerados nesta execução (User + Assistant calls + Tool results + Final Assistant)
  const executionTurns: ChatTurn[] = [
    { role: "user", content: opts.userMessage }
  ];

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

    console.log("[AGENT][RUNTIME] 🔧 Tool calls detected", {
      callId,
      iteration: iterations,
      toolCallCount: toolCalls.length,
      tools: toolCalls.map((tc: any) => tc.function.name)
    });

    // Adicionar mensagem do assistente (com tool_calls) ao histórico local e de execução
    const assistantMsg: any = {
      role: "assistant",
      content: resp.choices[0].message.content || "",
      tool_calls: resp.choices[0].message.tool_calls
    };
    messages.push(assistantMsg);
    executionTurns.push(assistantMsg);

    // Executar cada tool call
    const toolResults = await Promise.all(
      toolCalls.map(async (tc: any) => {
        const tool = agentTools.find(at => at.tool.key === tc.function.name);
        if (!tool) {
          console.log("[AGENT][RUNTIME] ❌ Tool not found", {
            callId,
            toolName: tc.function.name,
            availableTools: agentTools.map(at => at.tool.key)
          });
          return {
            tool_call_id: tc.id,
            role: "tool" as const,
            name: tc.function.name,
            content: JSON.stringify({ error: `Tool '${tc.function.name}' not found or not enabled` })
          };
        }

        try {
          const params = JSON.parse(tc.function.arguments);
          console.log("[AGENT][RUNTIME] 🛠️ Executing tool", {
            callId,
            toolName: tc.function.name,
            params
          });
          const result = await executeTool(tool.tool, tool, params, toolContext);
          console.log("[AGENT][RUNTIME] ✅ Tool execution success", {
            callId,
            toolName: tc.function.name,
            success: result.success,
            hasData: !!result.data,
            error: result.error
          });
          return {
            tool_call_id: tc.id,
            role: "tool" as const,
            name: tc.function.name,
            content: JSON.stringify(result)
          };
        } catch (error: any) {
          console.error("[AGENT][RUNTIME] ❌ Tool execution failed", {
            callId,
            toolName: tc.function.name,
            error: error.message || String(error)
          });
          return {
            tool_call_id: tc.id,
            role: "tool" as const,
            name: tc.function.name,
            content: JSON.stringify({ error: error.message || String(error) })
          };
        }
      })
    );

    // Adicionar resultados ao histórico
    messages.push(...toolResults as any);
    executionTurns.push(...toolResults as any);

    console.log("[AGENT][RUNTIME] 🔄 Continuing conversation after tools", {
      callId,
      iteration: iterations,
      messageCount: messages.length
    });

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
  const finishReason = resp.choices[0]?.finish_reason;

  console.log("[AGENT][RUNTIME] 💬 Reply generated", {
    callId,
    chatId: opts.chatId,
    agentId: agent.id,
    replyLength: reply.length,
    tokensUsed: resp.usage?.total_tokens || 0,
    model,
    finishReason,
    iterations,
  });

  // 6. Salvar contexto atualizado no Redis (incluindo tool calls intermediários)
  executionTurns.push({ role: "assistant", content: reply });
  await appendMultipleToContext(opts.chatId, executionTurns);

  return { reply, usage: resp.usage ?? undefined, agentId: agent.id, model };
}
