// frontend/src/pages/projects/ProjectCreate.tsx

import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProjectForm from "../../components/projects/ProjectForm";
import type { TemplateWithDetails, ProjectWithDetails } from "../../types/projects";
import { useUserProfile } from "../../hooks/useUserProfile";

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
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      {selectedTemplate ? (
        <ProjectForm 
          template={selectedTemplate} 
          project={projectToEdit}
          onClose={() => navigate(id ? `/projects/${id}` : "/projects")} 
          onSuccess={() => navigate(id ? `/projects/${id}` : "/projects")} 
          isModal={false}
        />
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-500">Nenhum template de projeto disponível.</p>
          <button 
            onClick={() => navigate("/projects")}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Voltar
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectCreate;
