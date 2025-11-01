// backend/src/services/agents.runtime.ts
import OpenAI from "openai";
import { supabaseAdmin } from "../lib/supabase.ts";
import { decryptSecret } from "../lib/crypto.ts";
import type { AgentRow } from "../repos/agents.repo.ts";
import { getActiveAgentForInbox, getAgent as repoGetAgent } from "../repos/agents.repo.ts";

export type ChatTurn = { role: "system" | "user" | "assistant"; content: string };

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

function buildPrompt(agent: AgentRow | null, chatHistory: ChatTurn[] | undefined, userMessage: string): ChatTurn[] {
  const sysParts: string[] = [];
  if (agent?.description) sysParts.push(String(agent.description));
  if (agent?.model_params && typeof agent.model_params === "object") {
    try {
      const rules = JSON.stringify(agent.model_params);
      sysParts.push(`Instrucoes do agente: ${rules}`);
    } catch {}
  }
  const system: ChatTurn = { role: "system", content: sysParts.join("\n\n").trim() || "Você é um atendente útil, breve e educado." };
  const history = (chatHistory || []).slice(-12);
  const finalUser: ChatTurn = { role: "user", content: userMessage };
  return [system, ...history, finalUser];
}

export async function runAgentReply(opts: {
  companyId: string;
  inboxId?: string | null;
  agentId?: string | null;
  userMessage: string;
  chatHistory?: ChatTurn[];
}): Promise<{ reply: string; usage?: any; agentId?: string | null; model?: string }>
{
  const agent = await getAgent(opts.companyId, opts.agentId);
  if (!agent) throw new Error("Nenhum agente ativo/configurado para esta empresa/inbox");

  const { apiKey, defaultModel } = await getOpenAISecretForCompany(opts.companyId, agent.integration_openai_id ?? undefined);

  const model = (agent.model || defaultModel || process.env.OPENAI_MODEL || "gpt-4o-mini").toString();
  const temperature = typeof agent.model_params?.temperature === "number" ? agent.model_params.temperature : 0.2;
  const maxTokens = typeof agent.model_params?.max_tokens === "number" ? agent.model_params.max_tokens : 512;

  const client = new OpenAI({ apiKey });
  const messages = buildPrompt(agent, opts.chatHistory, opts.userMessage);

  const resp = await client.responses.create({
    model,
    input: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature,
    max_output_tokens: maxTokens,
  });

  const chunks = resp.output?.map((o: any) => {
    if (o.type === "message") return (o.content || []).map((c: any) => (c.text ? c.text : "")).join("\n");
    if (o.type === "output_text") return o.text;
    return "";
  }) ?? [];

  const reply = chunks.join("\n").trim();
  return { reply, usage: (resp as any).usage ?? undefined, agentId: agent.id, model };
}
