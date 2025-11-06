// SimplifiedAgentPanel.tsx
// Painel principal simplificado para gerenciamento de agentes

import { useState } from "react";
import { AgentTemplateSelector } from "./AgentTemplateSelector";
import { AgentCreationWizard } from "./AgentCreationWizard";
import { SimplifiedAgentList } from "./SimplifiedAgentList";
import { AgentConfigPanel } from "./AgentConfigPanel";
import { fetchJson } from "../../utils/api";
import type { AgentTemplate, AgentTemplateQuestion } from "../../types/types";

const API = import.meta.env.VITE_API_URL;

type View = "list" | "selectTemplate" | "wizard" | "configure";

export function SimplifiedAgentPanel() {
  const [view, setView] = useState<View>("list");
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [templateQuestions, setTemplateQuestions] = useState<AgentTemplateQuestion[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleSelectTemplate(template: AgentTemplate) {
    try {
      // Carregar perguntas do template
      const questions = await fetchJson<AgentTemplateQuestion[]>(
        `${API}/api/agent-templates/${template.id}/questions`
      );

      setSelectedTemplate(template);
      setTemplateQuestions(questions);
      setView("wizard");
    } catch (error) {
      console.error("Erro ao carregar perguntas:", error);
      alert("Erro ao carregar configurações do template");
    }
  }

  async function handleCompleteWizard(answers: Record<string, any>) {
    if (!selectedTemplate) return;

    try {
      setCreating(true);

      // Criar agente via endpoint from-template
      const payload = {
        template_id: selectedTemplate.id,
        answers,
      };

      await fetchJson(`${API}/api/agents/from-template`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      alert("Agente criado com sucesso!");
      setView("list");
      setSelectedTemplate(null);
      setTemplateQuestions([]);
    } catch (error) {
      console.error("Erro ao criar agente:", error);
      alert("Erro ao criar agente. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  function handleEditAgent(agentId: string) {
    setSelectedAgentId(agentId);
    setView("configure");
  }

  function handleConfigSaved() {
    alert("Configurações salvas com sucesso!");
    setView("list");
    setSelectedAgentId(null);
  }

  if (creating) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mb-4" />
        <p className="text-white text-lg">Criando seu agente...</p>
      </div>
    );
  }

  if (view === "selectTemplate") {
    return (
      <AgentTemplateSelector
        onSelectTemplate={handleSelectTemplate}
        onBack={() => setView("list")}
      />
    );
  }

  if (view === "wizard" && selectedTemplate && templateQuestions.length > 0) {
    return (
      <AgentCreationWizard
        template={selectedTemplate}
        questions={templateQuestions}
        onComplete={handleCompleteWizard}
        onBack={() => setView("selectTemplate")}
      />
    );
  }

  if (view === "configure" && selectedAgentId) {
    return (
      <AgentConfigPanel
        agentId={selectedAgentId}
        onBack={() => {
          setView("list");
          setSelectedAgentId(null);
        }}
        onSaved={handleConfigSaved}
      />
    );
  }

  return (
    <SimplifiedAgentList
      onNewAgent={() => setView("selectTemplate")}
      onEditAgent={handleEditAgent}
    />
  );
}
