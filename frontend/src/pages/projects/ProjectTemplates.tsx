// frontend/src/pages/projects/ProjectTemplates.tsx

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Plus, 
  Search, 
  Settings, 
  Copy, 
  Trash2, 
  ChevronRight,
  Zap,
  Construction,
  Cpu,
  Wrench,
  Layout,
  MoreVertical,
  X
} from "lucide-react";
import TemplateWizard from "../../components/projects/TemplateWizard";
import { api } from "../../lib/api";
import { showToast } from "../../hooks/useToast";
import type { TemplateWithDetails } from "@livechat/shared";

interface Template extends TemplateWithDetails {
  stages_count?: number;
  fields_count?: number;
}

const ProjectTemplates: React.FC = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: "",
    description: "",
    industry: "generic"
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get("/projects/templates");
      setTemplates(response.data);
    } catch (error) {
      console.error("Error fetching templates:", error);
      showToast("Erro ao carregar templates", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/projects/templates", newTemplate);
      setShowCreateModal(false);
      fetchTemplates();
      showToast("Template criado com sucesso!", "success");
    } catch (error) {
      console.error("Error creating template:", error);
      showToast("Erro ao criar template", "error");
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      await api.put(`/projects/templates/${templateId}`, { is_default: true });
      fetchTemplates();
      showToast("Template definido como padrão", "success");
    } catch (error) {
      console.error("Error setting default template:", error);
      showToast("Erro ao definir padrão", "error");
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;
    try {
      await api.delete(`/projects/templates/${templateId}`);
      fetchTemplates();
      showToast("Template excluído", "success");
    } catch (error) {
      console.error("Error deleting template:", error);
      showToast("Erro ao excluir template", "error");
    }
  };

  const getIndustryIcon = (industry: string) => {
    switch (industry) {
      case "solar_energy": return <Zap className="w-6 h-6" />;
      case "construction": return <Construction className="w-6 h-6" />;
      case "education": return <Layout className="w-6 h-6" />;
      case "accounting": return <Layout className="w-6 h-6" />;
      case "clinic": return <Layout className="w-6 h-6" />;
      case "real_estate": return <Layout className="w-6 h-6" />;
      case "law": return <Layout className="w-6 h-6" />;
      case "events": return <Layout className="w-6 h-6" />;
      default: return <Layout className="w-6 h-6" />;
    }
  };

  if (showWizard) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => setShowWizard(false)}
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-colors font-medium group"
        >
          <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform" />
          Voltar para Lista de Templates
        </button>
        <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md">
          <TemplateWizard onComplete={() => {
            setShowWizard(false);
            fetchTemplates();
          }} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Templates de Projeto</h1>
          <p className="text-slate-400 mt-1">Padronize seus processos com fluxos de trabalho pré-definidos.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
        >
          <Plus className="w-5 h-5" />
          Criar Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Seed Templates Card */}
        <div className="bg-linear-to-br from-indigo-600 to-violet-700 rounded-2xl p-8 text-white shadow-xl relative overflow-hidden group border border-white/10">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mb-6 backdrop-blur-md">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-3">Biblioteca de Indústria</h3>
            <p className="text-indigo-100 text-sm mb-8 leading-relaxed">
              Importe fluxos completos e campos personalizados otimizados para o seu nicho de mercado.
            </p>
            <button 
              onClick={() => setShowWizard(true)}
              className="w-full py-3 bg-white text-indigo-600 rounded-xl text-sm font-bold hover:bg-indigo-50 transition-all shadow-lg active:scale-[0.98]"
            >
              Explorar Biblioteca
            </button>
          </div>
        </div>

        {templates.map((template) => (
          <div 
            key={template.id}
            className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 hover:shadow-2xl hover:border-indigo-500/30 hover:bg-slate-800/60 transition-all group backdrop-blur-sm relative overflow-hidden"
          >
            {/* Barra lateral de cor opcional */}
            {template.color && (
              <div 
                className="absolute top-0 left-0 bottom-0 w-1"
                style={{ backgroundColor: template.color }}
              />
            )}

            <div className="flex items-start justify-between mb-6">
              <div 
                className="p-3 rounded-xl transition-colors"
                style={{ 
                  backgroundColor: template.color ? `${template.color}15` : 'rgba(99, 102, 241, 0.1)',
                  color: template.color || '#6366f1'
                }}
              >
                {getIndustryIcon(template.industry)}
              </div>
              <div className="flex items-center gap-2">
                {!template.is_default && (
                  <button 
                    onClick={() => handleSetDefault(template.id)}
                    className="px-2.5 py-1 bg-slate-800/50 text-slate-400 text-[10px] font-bold rounded-lg border border-white/5 hover:bg-indigo-500/10 hover:text-indigo-400 hover:border-indigo-500/20 transition-all"
                  >
                    TORNAR PADRÃO
                  </button>
                )}
                {template.is_default && (
                  <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/20">
                    PADRÃO
                  </span>
                )}
                <button className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-xl font-bold text-white mb-2">{template.name}</h3>
            <p className="text-sm text-slate-400 line-clamp-2 mb-8 h-10 leading-relaxed">
              {template.description || "Nenhuma descrição fornecida para este template de projeto."}
            </p>

            <div className="flex items-center gap-8 mb-8">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Estágios</p>
                <div className="flex items-center gap-1.5">
                  <Layout className="w-3.5 h-3.5 text-indigo-400" />
                  <p className="text-xl font-bold text-white leading-none">{template.stages_count}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Campos</p>
                <div className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                  <p className="text-xl font-bold text-white leading-none">{template.fields_count}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-6 border-t border-white/5">
              <button 
                onClick={() => navigate(`/admin/projects/templates/${template.id}`)}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2 border border-white/5 active:scale-95"
              >
                <Settings className="w-4 h-4" />
                Configurar
              </button>
              <button className="p-2.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-xl transition-all border border-transparent hover:border-indigo-500/20 active:scale-90">
                <Copy className="w-4 h-4" />
              </button>
              <button 
                onClick={() => handleDeleteTemplate(template.id)}
                className="p-2.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20 active:scale-90"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Create New Card */}
        <button 
          onClick={() => setShowCreateModal(true)}
          className="border-2 border-dashed border-white/5 rounded-2xl p-6 flex flex-col items-center justify-center text-center hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all group group-active:scale-[0.98]"
        >
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-indigo-500 group-hover:text-white transition-all shadow-inner">
            <Plus className="w-7 h-7 text-slate-600 group-hover:text-white" />
          </div>
          <h3 className="text-sm font-bold text-white">Novo Template Personalizado</h3>
          <p className="text-xs text-slate-500 mt-2 max-w-[180px]">Personalize cada detalhe do fluxo da sua empresa.</p>
        </button>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-white/5 flex items-center justify-between bg-slate-800/50">
              <h2 className="text-xl font-bold text-white">Novo Template</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateTemplate} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nome do Template</label>
                <input 
                  type="text"
                  required
                  value={newTemplate.name}
                  onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/5 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600"
                  placeholder="Ex: Fluxo de Vendas Solar"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descrição</label>
                <textarea 
                  value={newTemplate.description}
                  onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/5 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none h-28 resize-none transition-all placeholder:text-slate-600"
                  placeholder="Descreva o objetivo deste template..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Indústria/Nicho</label>
                <select 
                  value={newTemplate.industry}
                  onChange={e => setNewTemplate({...newTemplate, industry: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/5 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="generic">Genérico</option>
                  <option value="solar_energy">Energia Solar</option>
                  <option value="construction" className="bg-slate-900">Construção Civil</option>
                  <option value="accounting" className="bg-slate-900">Contabilidade</option>
                  <option value="law" className="bg-slate-900">Advocacia</option>
                  <option value="clinic" className="bg-slate-900">Clínica/Saúde</option>
                  <option value="real_estate" className="bg-slate-900">Imobiliária</option>
                  <option value="education" className="bg-slate-900">Educação</option>
                  <option value="events" className="bg-slate-900">Eventos</option>
                </select>
              </div>
              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-3 text-sm font-bold text-slate-400 bg-slate-800 rounded-xl hover:bg-slate-700 transition-all border border-white/5 active:scale-95"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-3 text-sm font-bold text-white bg-indigo-500 rounded-xl hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
                >
                  Criar Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectTemplates;

