// frontend/src/pages/projects/ProjectCreate.tsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  ChevronLeft, 
  Zap, 
  Construction, 
  Cpu, 
  Wrench, 
  Layout, 
  CheckCircle2,
  Sun,
  Scale,
  Calculator,
  Stethoscope,
  Home,
  GraduationCap,
  ShoppingBag,
  PartyPopper
} from "lucide-react";
import ProjectForm from "../../components/projects/ProjectForm";
import type { TemplateWithDetails } from "../../types/projects";
import { useUserProfile } from "../../hooks/useUserProfile";

const API = import.meta.env.VITE_API_URL;

const ProjectCreate: React.FC = () => {
  const navigate = useNavigate();
  const { profile, loading: profileLoading } = useUserProfile();
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [isAutoSelecting, setIsAutoSelecting] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  // Efeito para buscar detalhes do template selecionado
  useEffect(() => {
    if (selectedTemplate && (!selectedTemplate.custom_fields || !selectedTemplate.stages)) {
      fetchTemplateDetails(selectedTemplate.id);
    }
  }, [selectedTemplate]);

  const fetchTemplateDetails = async (id: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/projects/templates/${id}`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setSelectedTemplate(data);
      }
    } catch (error) {
      console.error("Error fetching template details:", error);
    } finally {
      setLoading(false);
    }
  };

  // Efeito para seleção automática de template baseado no nicho da empresa
  useEffect(() => {
    if (!loading && !profileLoading) {
      if (profile?.industry && templates.length > 0 && step === 1) {
        // Tenta encontrar um template que combine com o nicho da empresa
        // Prioriza templates marcados como is_default
        const matchingTemplate = templates.find(t => t.industry === profile.industry && t.is_default) 
          || templates.find(t => t.industry === profile.industry);

        if (matchingTemplate) {
          console.log(`[ProjectCreate] 🎯 Auto-selecting template for industry: ${profile.industry}`);
          setSelectedTemplate(matchingTemplate);
          setStep(2);
        } else {
          console.log(`[ProjectCreate] ⚠️ No matching template found for industry: ${profile.industry}`);
        }
      }
      setIsAutoSelecting(false);
    }
  }, [loading, profileLoading, profile, templates, step]);

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

  const getIndustryIcon = (industry: string) => {
    switch (industry) {
      case "solar_energy": return <Sun className="w-8 h-8 text-amber-500" />;
      case "construction": return <Construction className="w-8 h-8 text-orange-600" />;
      case "law": return <Scale className="w-8 h-8 text-slate-600" />;
      case "accounting": return <Calculator className="w-8 h-8 text-emerald-600" />;
      case "clinic": return <Stethoscope className="w-8 h-8 text-rose-600" />;
      case "real_estate": return <Home className="w-8 h-8 text-blue-600" />;
      case "education": return <GraduationCap className="w-8 h-8 text-indigo-600" />;
      case "retail": return <ShoppingBag className="w-8 h-8 text-pink-600" />;
      case "events": return <PartyPopper className="w-8 h-8 text-purple-600" />;
      default: return <Layout className="w-8 h-8 text-gray-500" />;
    }
  };

  if (loading || profileLoading || (isAutoSelecting && profile?.industry)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button 
        onClick={() => navigate("/projects")}
        className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 mb-8 transition-colors group font-semibold"
      >
        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
        <span>Voltar para Projetos</span>
      </button>

      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-gray-100 bg-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight">Novo Projeto</h1>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${step >= 1 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400'}`}>1</div>
              <div className={`w-12 h-1.5 rounded-full transition-all ${step >= 2 ? 'bg-indigo-600' : 'bg-gray-100'}`}></div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${step >= 2 ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-gray-100 text-gray-400'}`}>2</div>
            </div>
          </div>
          <p className="text-gray-600 text-lg font-medium">
            {step === 1 ? "Selecione um template para começar seu projeto." : `Configurando: ${selectedTemplate?.name}`}
          </p>
        </div>

        <div className="p-8">
          {step === 1 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {templates.map((template) => (
                <div 
                  key={template.id}
                  onClick={() => {
                    setSelectedTemplate(template);
                    setStep(2);
                  }}
                  className="group p-6 rounded-2xl border-2 border-gray-100 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all cursor-pointer relative overflow-hidden"
                >
                  <div className="flex items-start gap-4">
                    <div className="p-4 bg-white rounded-2xl shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                      {getIndustryIcon(template.industry)}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{template.name}</h3>
                      <p className="text-sm text-gray-500 leading-relaxed">{template.description}</p>
                      <div className="flex items-center gap-4 mt-4">
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md uppercase tracking-wider">
                          {(template as any).stages_count || 0} Estágios
                        </span>
                        <span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded-md uppercase tracking-wider">
                          {(template as any).fields_count || 0} Campos
                        </span>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            selectedTemplate && (
              <ProjectForm 
                template={selectedTemplate} 
                onClose={() => setStep(1)} 
                onSuccess={() => navigate("/projects")} 
              />
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectCreate;
