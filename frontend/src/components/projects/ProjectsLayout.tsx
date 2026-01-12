// frontend/src/components/projects/ProjectsLayout.tsx

import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchJson } from "../../lib/fetch";
import type { TemplateWithDetails } from "@livechat/shared";
import ProjectKanbanBoard from "./ProjectKanbanBoard";
import ProjectStats from "./ProjectStats";
import TemplateWizard from "./TemplateWizard";
import TemplateSelector from "./TemplateSelector";
import { Button } from "../ui/Button";

const API = import.meta.env.VITE_API_URL;

export default function ProjectsLayout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithDetails | null>(null);
  const [activeTab, setActiveTab] = useState<'kanban' | 'stats'>('kanban');
  const [showWizard, setShowWizard] = useState(false);
  const [loading, setLoading] = useState(true);

  // Carregar templates
  useEffect(() => {
    fetchJson<TemplateWithDetails[]>(`${API}/projects/templates`)
      .then((data) => {
        setTemplates(data);
        
        // Selecionar template inicial
        const templateIdFromUrl = searchParams.get('template');
        if (templateIdFromUrl) {
          const template = data.find(t => t.id === templateIdFromUrl);
          if (template) setSelectedTemplate(template);
        } else if (data.length > 0) {
          setSelectedTemplate(data[0]);
        }
        
        // Se não tem templates, mostrar wizard
        if (data.length === 0) {
          setShowWizard(true);
        }
      })
      .finally(() => setLoading(false));
  }, [searchParams]);

  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setSelectedTemplate(template);
      setSearchParams({ template: templateId });
    }
  };

  const handleWizardComplete = () => {
    // Recarregar templates após criar um novo via wizard
    fetchJson<TemplateWithDetails[]>(`${API}/projects/templates`)
      .then((data) => {
        setTemplates(data);
        if (data.length > 0) {
          const last = data[data.length - 1];
          setSelectedTemplate(last);
          setSearchParams({ template: last.id });
        }
        setShowWizard(false);
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Carregando projetos...</p>
        </div>
      </div>
    );
  }

  if (showWizard && templates.length > 0) {
    // Se já tem templates, o wizard é o seletor
    return (
      <div className="fixed inset-0 z-50 bg-gray-50 dark:bg-gray-900 overflow-y-auto">
        <div className="p-4 flex justify-end">
          <Button onClick={() => setShowWizard(false)} variant="ghost">Fechar</Button>
        </div>
        <TemplateSelector onSelect={(t) => {
          setSelectedTemplate(t);
          setSearchParams({ template: t.id });
          setShowWizard(false);
        }} />
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">📋</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Nenhum template configurado
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Configure seu primeiro template de projeto para começar a gerenciar seus projetos. 
          </p>
          <Button onClick={() => setShowWizard(true)} variant="primary" size="lg">
            Configurar Agora
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
              <span className="text-lg">{selectedTemplate?.icon}</span>
              <select
                value={selectedTemplate?.id}
                onChange={(e) => handleTemplateChange(e.target.value)}
                className="bg-transparent border-none text-sm font-bold text-indigo-900 dark:text-indigo-300 focus:ring-0 cursor-pointer"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-2" />

            <div className="flex bg-gray-100 dark:bg-gray-700 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('kanban')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'kanban' 
                    ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Kanban
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'stats' 
                    ? 'bg-white dark:bg-gray-600 text-indigo-600 dark:text-white shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
                }`}
              >
                Estatísticas
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => setShowWizard(true)} variant="ghost" size="sm">
              Mudar Template
            </Button>
            <Button variant="primary" size="sm" onClick={() => window.dispatchEvent(new CustomEvent('open-project-form'))}>
              Novo Projeto
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'kanban' && selectedTemplate && (
          <ProjectKanbanBoard template={selectedTemplate} />
        )}
        {activeTab === 'stats' && selectedTemplate && (
          <ProjectStats templateId={selectedTemplate.id} />
        )}
      </div>
    </div>
  );
}
