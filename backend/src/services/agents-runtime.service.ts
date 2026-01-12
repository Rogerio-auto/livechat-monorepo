// backend/src/services/agents-runtime.service.ts
import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase.js";
import { decryptSecret } from "../lib/crypto.js";
import type { AgentRow } from "../repos/agents.repo.js";
import { getActiveAgentForInbox, getAgent as repoGetAgent } from "../repos/agents.repo.js";
import { listAgentTools } from "../repos/tools.repo.js";
import { executeTool, type ToolExecutionContext } from "./tool-handlers.service.js";
import { getAgentContext, appendMultipleToContext } from "./agent-context.service.js";
import { db } from "../pg.js";
import { AgentMonitoringService } from "./agent-monitoring.service.js";
import { getIO, hasIO } from "../lib/io.js";
import { AgentMetricsRepository } from "../repos/agent-metrics.repo.js";
import { logOpenAIUsage, checkAIUsagePermission } from "./openai-usage.service.js";

export type ChatTurn = { 
  role: "system" | "user" | "assistant" | "tool"; 
  content: string | null; 
  tool_call_id?: string; 
  name?: string;
  tool_calls?: any[];
};

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

        // 🆕 Log de uso de transcrição
        const durationSeconds = Math.ceil(audioBuffer.byteLength / 16000); // Estimativa
        await logOpenAIUsage({
          companyId: opts.agent.company_id,
          integrationId: opts.agent.integration_openai_id || undefined,
          agentId: opts.agent.id,
          chatId: opts.chatId,
          model: opts.agent.transcription_model,
          promptTokens: durationSeconds * 60, // Conversão para "tokens"
          completionTokens: 0,
          requestType: 'transcription',
          requestMetadata: {
            duration_seconds: durationSeconds,
            audio_size_bytes: audioBuffer.byteLength,
          },
        }).catch(console.error);

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

        // 🆕 Log de uso de visão
        await logOpenAIUsage({
          companyId: opts.agent.company_id,
          integrationId: opts.agent.integration_openai_id || undefined,
          agentId: opts.agent.id,
          chatId: opts.chatId,
          model: opts.agent.vision_model,
          promptTokens: visionResponse.usage?.prompt_tokens || 0,
          completionTokens: visionResponse.usage?.completion_tokens || 0,
          requestType: 'vision',
          requestMetadata: {
            image_url: imageUrl,
            finish_reason: visionResponse.choices[0]?.finish_reason,
          },
        }).catch(console.error);

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
      sysParts.push("SPECIFIC INSTRUCTION: 'send_interactive_buttons' sends a message to the user. AFTER calling this tool, STOP immediately. Do NOT generate more text. Wait for the user to click.");
    }
    // Instrução específica para listas
    if (tools.some((t: any) => t.tool.key === 'send_interactive_list')) {
      sysParts.push("SPECIFIC INSTRUCTION: 'send_interactive_list' sends a message to the user. AFTER calling this tool, STOP immediately. Do NOT generate more text. Wait for the user to select an option.");
    }
  }

  // Regra de exceção para formatos de saída JSON (conflito comum)
  sysParts.push(`
CRITICAL EXCEPTION FOR OUTPUT FORMAT:
If your instructions mention a specific JSON output format (like {"message": [...]}), YOU MUST IGNORE THAT FORMAT when calling a tool.
- If you use a tool: DO NOT output JSON text. Just generate the tool call.
- If you reply with text: Follow the required JSON format.

CRITICAL FLOW CONTROL:
- If you use a tool that interacts with the user (buttons, lists), YOU MUST STOP. Do not continue to the next step of your instructions in the same turn.
`.trim());

  const system: ChatTurn = { role: "system", content: sysParts.join("\n\n").trim() || "Você é um atendente útil, breve e educado." };
  
  // Limitar histórico Redis aos últimos 12 turnos (excluindo system)
  const recentHistory = contextHistory.filter(t => t.role !== "system").slice(-12);

  // Sanitize: Remove orphaned tool messages at the start (caused by slicing)
  while (recentHistory.length > 0 && recentHistory[0].role === "tool") {
    recentHistory.shift();
  }
  
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
  isPlayground?: boolean;
  agentOverride?: any;
}): Promise<{ 
  reply: string; 
  usage?: any; 
  agentId?: string | null; 
  model?: string; 
  skipped?: boolean; 
  reason?: string;
  steps?: any[];
}>
{
  const callId = `${opts.chatId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const startTime = Date.now();
  
  let agent: any = null;
  let model: string = "gpt-4o-mini";
  let executionTurns: ChatTurn[] = [];

  try {
    agent = await getAgent(opts.companyId, opts.agentId);
    
    if (opts.agentOverride) {
      agent = { ...(agent || {}), ...opts.agentOverride };
    }

    if (!agent) {
      console.warn("[AGENT][RUNTIME] ❌ No active agent found", { callId, companyId: opts.companyId });
      return {
        reply: "",
        skipped: true,
        reason: "Nenhum agente ativo/configurado para esta empresa/inbox",
        agentId: null,
      };
    }

    // 🆕 VALIDAÇÃO DE SEGURANÇA: Assinatura e Faturas
    const permission = await checkAIUsagePermission(opts.companyId);
    if (!permission.allowed) {
      console.warn("[AGENT][RUNTIME] 🔒 Usage blocked:", { companyId: opts.companyId, reason: permission.reason });
      return {
        reply: `Desculpe, o serviço de IA está temporariamente indisponível para esta conta. Motivo: ${permission.reason}`,
        skipped: true,
        reason: permission.reason,
        agentId: agent.id,
      };
    }

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

    model = (agent.model || defaultModel || process.env.OPENAI_MODEL || "gpt-4o-mini").toString();
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
        let schema = raw;
        if (typeof raw === "string") {
          try {
            schema = JSON.parse(raw);
          } catch (e) {
            console.warn("[AGENT][RUNTIME] Failed to parse tool schema JSON", { raw });
          }
        }
        if (schema && typeof schema === "object") {
          if (schema.type === "function" && schema.function && typeof schema.function === "object") {
            const p = (schema.function as any).parameters;
            return p && typeof p === "object" ? p : { type: "object", properties: {} };
          }
          if (schema.parameters && typeof schema.parameters === "object" && !schema.type) {
            return schema.parameters;
          }
          if (schema.function && typeof schema.function === "object" && schema.function.parameters) {
            return schema.function.parameters;
          }
          if (schema.type === "object" || schema.properties || schema.required) {
            return { type: "object", additionalProperties: true, ...schema };
          }
        }
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
      companyId: opts.companyId,
      isPlayground: opts.isPlayground,
    };

    // 5. Loop de function calling
    executionTurns = [
      { role: "user", content: opts.userMessage }
    ];

    let resp = await client.chat.completions.create({
      model,
      messages: messages as any,
      tools,
      temperature,
      max_tokens: maxTokens,
    });

    // 🆕 Log de uso (primeira chamada)
    await logOpenAIUsage({
      companyId: opts.companyId,
      integrationId: agent.integration_openai_id || undefined,
      agentId: agent.id,
      chatId: opts.chatId,
      model,
      promptTokens: resp.usage?.prompt_tokens || 0,
      completionTokens: resp.usage?.completion_tokens || 0,
      requestType: 'chat',
      requestMetadata: {
        tools_count: tools?.length || 0,
        finish_reason: resp.choices[0]?.finish_reason,
        has_tool_calls: !!resp.choices[0]?.message?.tool_calls,
        iteration: 0
      },
    }).catch(err => console.error('[Agent Runtime] Failed to log usage:', err));

    let iterations = 0;
    const MAX_ITERATIONS = 5;
    let accumulatedReply = "";

    while (resp.choices[0]?.finish_reason === 'tool_calls' && iterations < MAX_ITERATIONS) {
      iterations++;
      const toolCalls = resp.choices[0].message.tool_calls as any[];
      if (!toolCalls || toolCalls.length === 0) break;

      // Acumular conteúdo textual se houver (antes de chamar a ferramenta)
      // ⚠️ Se o agente estiver chamando uma ferramenta de mensagem interativa, 
      // evitamos acumular o texto do 'content' para não duplicar a mensagem no chat.
      const isSendingInteractive = toolCalls.some(tc => 
        tc.function.name === 'send_interactive_buttons' || 
        tc.function.name === 'send_interactive_list'
      );

      if (resp.choices[0].message.content && !isSendingInteractive) {
        accumulatedReply += resp.choices[0].message.content + "\n";
      }

      const assistantMsg: any = {
        role: "assistant",
        content: resp.choices[0].message.content || "",
        tool_calls: resp.choices[0].message.tool_calls
      };
      messages.push(assistantMsg);
      executionTurns.push(assistantMsg);

      const toolResults = await Promise.all(
        toolCalls.map(async (tc: any) => {
          const tool = agentTools.find(at => at.tool.key === tc.function.name);
          if (!tool) {
            return {
              tool_call_id: tc.id,
              role: "tool" as const,
              name: tc.function.name,
              content: JSON.stringify({ error: `Tool '${tc.function.name}' not found or not enabled` })
            };
          }

          try {
            const params = JSON.parse(tc.function.arguments);
            const result = await executeTool(tool.tool, tool, params, toolContext);
            return {
              tool_call_id: tc.id,
              role: "tool" as const,
              name: tc.function.name,
              content: JSON.stringify(result)
            };
          } catch (error: any) {
            return {
              tool_call_id: tc.id,
              role: "tool" as const,
              name: tc.function.name,
              content: JSON.stringify({ error: error.message || String(error) })
            };
          }
        })
      );

      messages.push(...toolResults as any);
      executionTurns.push(...toolResults as any);

      resp = await client.chat.completions.create({
        model,
        messages: messages as any,
        tools,
        temperature,
        max_tokens: maxTokens,
      });

      // 🆕 Log de uso (iterações de ferramentas)
      await logOpenAIUsage({
        companyId: opts.companyId,
        integrationId: agent.integration_openai_id || undefined,
        agentId: agent.id,
        chatId: opts.chatId,
        model,
        promptTokens: resp.usage?.prompt_tokens || 0,
        completionTokens: resp.usage?.completion_tokens || 0,
        requestType: 'chat',
        requestMetadata: {
          tools_count: tools?.length || 0,
          finish_reason: resp.choices[0]?.finish_reason,
          has_tool_calls: !!resp.choices[0]?.message?.tool_calls,
          iteration: iterations
        },
      }).catch(err => console.error('[Agent Runtime] Failed to log usage:', err));
    }

    const finalContent = resp.choices[0]?.message?.content || '';
    const reply = (accumulatedReply + finalContent).trim();
    const finishReason = resp.choices[0]?.finish_reason;

    // 6. Salvar contexto atualizado no Redis (incluindo tool calls intermediários)
    executionTurns.push({ role: "assistant", content: reply });
    await appendMultipleToContext(opts.chatId, executionTurns);

    // MONITORAMENTO: Log de métricas e emissão de evento
    const duration = Date.now() - startTime;
    const usage = resp.usage;
    
    // Atualizar métricas de forma assíncrona para não bloquear a resposta
    AgentMetricsRepository.updateMetrics(agent.id, opts.companyId, 'day', {
      total_conversations: 1,
      total_tokens: usage?.total_tokens || 0,
      total_cost: calculateCost(model, usage?.prompt_tokens || 0, usage?.completion_tokens || 0)
    }).catch(err => console.error("Error updating metrics:", err));

    // Emitir evento via WebSocket
    if (hasIO()) {
      const io = getIO();
      io.to(`company:${opts.companyId}`).emit('agent:activity', {
        agentId: agent.id,
        agentName: agent.name,
        chatId: opts.chatId,
        type: 'message',
        duration,
        tokens: usage?.total_tokens || 0
      });
    }

    return { 
      reply, 
      usage: resp.usage ?? undefined, 
      agentId: agent.id, 
      model,
      steps: executionTurns 
    };
  } catch (error: any) {
    console.error("[AGENT][RUNTIME] ❌ Critical error in runAgentReply:", error);
    
    // Logar erro no banco
    if (opts.agentId) {
      AgentMonitoringService.logAgentError({
        agentId: opts.agentId,
        companyId: opts.companyId,
        chatId: opts.chatId,
        errorType: 'RUNTIME_ERROR',
        errorMessage: error.message || 'Unknown error',
        severity: 'HIGH',
        metadata: { stack: error.stack, opts }
      }).catch(err => console.error("Error logging agent error:", err));
    }

    let userFriendlyMessage = "Desculpe, ocorreu um erro interno ao processar sua solicitação.";
    
    // Tratamento de erros comuns para feedback melhor
    if (error.message) {
      if (error.message.includes("OPENAI_API_KEY") || error.message.includes("API key")) {
        userFriendlyMessage = "Erro de configuração: Chave de API da IA não configurada ou inválida.";
      } else if (error.status === 401) {
        userFriendlyMessage = "Erro de autenticação com o provedor de IA (401). Verifique a API Key.";
      } else if (error.status === 429) {
        userFriendlyMessage = "O agente está sobrecarregado ou sem créditos (429). Tente novamente mais tarde.";
      } else if (error.code === 'insufficient_quota') {
        userFriendlyMessage = "A conta da OpenAI está sem créditos (Quota Exceeded).";
      }
    }

    return {
      reply: userFriendlyMessage,
      agentId: opts.agentId,
      reason: error.message
    };
  }
}

function calculateCost(model: string, promptTokens: number, completionTokens: number): number {
  // Preços aproximados por 1k tokens
  const rates: Record<string, { prompt: number, completion: number }> = {
    'gpt-4o': { prompt: 0.005, completion: 0.015 },
    'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
    'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 }
  };
  
  const rate = rates[model] || rates['gpt-4o-mini'];
  return (promptTokens / 1000 * rate.prompt) + (completionTokens / 1000 * rate.completion);
}
