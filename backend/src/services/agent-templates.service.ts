import type { AgentTemplateRow, AgentTemplateQuestionRow } from "../repos/agent-templates.repo.js";

/**
 * Renderiza um template de prompt substituindo {{chave}} por respostas.
 * - Placeholders ausentes ficam vazios.
 * - Arrays são juntados por ", ".
 * - Valores booleanos/numéricos são convertidos para string.
 */
export function renderPromptTemplate(prompt: string, answers: Record<string, unknown>): string {
  if (!prompt) return "";
  const safe = answers || {};
  return prompt.replace(/{{\s*([a-zA-Z0-9_\.\-]+)\s*}}/g, (_m, key) => {
    const raw = (safe as any)[key];
    if (raw === undefined || raw === null) return "";
    if (Array.isArray(raw)) return raw.join(", ");
    if (typeof raw === "object") {
      try { return JSON.stringify(raw); } catch { return ""; }
    }
    return String(raw);
  });
}

export function buildAgentFromTemplate(
  template: AgentTemplateRow,
  answers: Record<string, unknown>,
): {
  description: string;
  model: string | null;
  model_params: Record<string, unknown>;
  tools: unknown[];
} {
  const description = renderPromptTemplate(template.prompt_template, answers).trim();
  const model = template.default_model ?? null;
  const model_params = template.default_model_params || {};
  const tools = Array.isArray(template.default_tools) ? template.default_tools : [];
  return { description, model, model_params, tools };
}

export type PreviewPayload = {
  prompt: string;
  model: string | null;
  model_params: Record<string, unknown>;
  tools: unknown[];
};

export function previewTemplate(
  template: AgentTemplateRow,
  answers: Record<string, unknown>,
): PreviewPayload {
  const built = buildAgentFromTemplate(template, answers);
  return {
    prompt: built.description,
    model: built.model,
    model_params: built.model_params,
    tools: built.tools,
  };
}
