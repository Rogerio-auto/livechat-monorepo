// frontend/src/pages/projects/ProjectCreate.tsx

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProjectForm from "../../components/projects/ProjectForm";
import type { TemplateWithDetails, ProjectWithDetails } from "../../types/projects";
import { useUserProfile } from "../../hooks/useUserProfile";
import { Breadcrumbs } from "../../components/Breadcrumbs";
import { ArrowLeft } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

const ProjectCreate: React.FC = () => {
  const { id } = useParams(); // ID do projeto para edição
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useUserProfile();
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithDetails | null>(null);
  const [projectToEdit, setProjectToEdit] = useState<ProjectWithDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Se tiver ID, busca o projeto para edição
  useEffect(() => {
    if (id) {
      fetchProjectToEdit(id);
    }
  }, [id]);

  const fetchProjectToEdit = async (projectId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/projects/${projectId}`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setProjectToEdit(data);
        
        // Se o projeto tem um template, busca os detalhes dele
        if (data.template_id) {
           fetchTemplateDetails(data.template_id);
        }
      } else {
        console.error("Failed to fetch project");
        navigate("/projects");
      }
    } catch (error) {
      console.error("Error fetching project:", error);
      navigate("/projects");
    } finally {
      setLoading(false);
    }
  };

  // Efeito para buscar detalhes do template selecionado
  useEffect(() => {
    if (selectedTemplate && (!selectedTemplate.custom_fields || !selectedTemplate.stages)) {
      fetchTemplateDetails(selectedTemplate.id);
    }
  }, [selectedTemplate]);

  const fetchTemplateDetails = async (templateId: string) => {
    try {
      // Evita loading se já estiver carregando projeto
      if (!id) setLoading(true);
      
      const response = await fetch(`${API}/projects/templates/${templateId}`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedTemplate(data);
      }
    } catch (error) {
      console.error("Error fetching template details:", error);
    } finally {
      if (!id) setLoading(false);
    }
  };

  // Efeito para seleção automática de template baseado no nicho da empresa (apenas criação)
  useEffect(() => {
    if (!id && !loading && !profileLoading && templates.length > 0) {
      // Se já temos um template selecionado, não faz nada
      if (selectedTemplate) return;

      let matchingTemplate = null;

      if (profile?.industry) {
        // Tenta encontrar um template que combine com o nicho da empresa
        matchingTemplate = templates.find(t => t.industry === profile.industry && t.is_default) 
          || templates.find(t => t.industry === profile.industry);
      }

      // Se não encontrou por nicho, pega o primeiro disponível (fallback)
      if (!matchingTemplate) {
        matchingTemplate = templates[0];
      }

      if (matchingTemplate) {
        console.log(`[ProjectCreate] 🎯 Auto-selecting template: ${matchingTemplate.name}`);
        setSelectedTemplate(matchingTemplate);
      }
    }
  }, [id, loading, profileLoading, profile, templates]);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/projects/templates`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || profileLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-screen bg-white dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900 min-h-screen">
      <div className="w-full max-w-[1200px] mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumbs 
          items={[
            { label: "Projetos", href: "/projects" },
            { label: id ? "Editar Projeto" : "Novo Projeto", active: true }
          ]} 
        />

        <div className="mb-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-4xl font-bold text-(--color-text) tracking-tight">
                {id ? "Editar Projeto" : "Novo Projeto"}
              </h1>
              <p className="mt-2 text-lg text-(--color-text-muted)">
                {id ? "Altere as informações do seu projeto." : "Preencha os dados para iniciar um novo projeto."}
              </p>
            </div>
            
            <button
              onClick={() => navigate(id ? `/projects/${id}` : "/projects")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-(--color-text-muted) hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            {selectedTemplate ? (
              <ProjectForm 
                template={selectedTemplate} 
                project={projectToEdit || undefined}
                onClose={() => navigate(id ? `/projects/${id}` : "/projects")} 
                onSuccess={() => navigate(id ? `/projects/${id}` : "/projects")} 
                isModal={false}
              />
            ) : (
              <div className="p-12 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-center">
                <p className="text-slate-500">Nenhum template de projeto disponível.</p>
                <button 
                  onClick={() => navigate("/projects")}
                  className="mt-6 text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                >
                  Voltar para lista
                </button>
              </div>
            )}
          </div>

          {/* Sidebar Info Column */}
          <div className="space-y-6">
            <div className="p-6 border border-slate-100 dark:border-slate-800 rounded-xl">
              <h3 className="text-sm font-bold uppercase tracking-wider text-(--color-text-muted) mb-4 flex items-center gap-2">
                Dicas Rápidas
              </h3>
              <ul className="space-y-4 text-sm text-(--color-text-muted)">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">1</span>
                  <p>Escolha um título descritivo para facilitar a identificação.</p>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">2</span>
                  <p>Vincule um cliente para centralizar todas as comunicações.</p>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-5 h-5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 text-xs font-bold">3</span>
                  <p>Defina prazos realistas para manter a equipe alinhada.</p>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectCreate;
