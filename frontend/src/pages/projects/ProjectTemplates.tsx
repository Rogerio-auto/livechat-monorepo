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

const API = import.meta.env.VITE_API_URL;

interface Template {
  id: string;
  name: string;
  description: string;
  industry: string;
  icon: string;
  color: string;
  stages_count: number;
  fields_count: number;
  is_default: boolean;
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

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API}/projects/templates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTemplate),
        credentials: "include"
      });
      if (response.ok) {
        setShowCreateModal(false);
        fetchTemplates();
      }
    } catch (error) {
      console.error("Error creating template:", error);
    }
  };

  const handleSetDefault = async (templateId: string) => {
    try {
      const response = await fetch(`${API}/projects/templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
        credentials: "include"
      });
      if (response.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error("Error setting default template:", error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;
    try {
      const response = await fetch(`${API}/projects/templates/${templateId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (response.ok) {
        fetchTemplates();
      }
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  const getIndustryIcon = (industry: string) => {
    switch (industry) {
      case "solar_energy": return <Zap className="w-6 h-6 text-amber-500" />;
      case "construction": return <Construction className="w-6 h-6 text-red-500" />;
      case "education": return <Layout className="w-6 h-6 text-blue-500" />;
      case "accounting": return <Layout className="w-6 h-6 text-emerald-500" />;
      case "clinic": return <Layout className="w-6 h-6 text-rose-500" />;
      case "real_estate": return <Layout className="w-6 h-6 text-orange-500" />;
      case "law": return <Layout className="w-6 h-6 text-slate-500" />;
      case "events": return <Layout className="w-6 h-6 text-pink-500" />;
      default: return <Layout className="w-6 h-6 text-gray-500" />;
    }
  };

  if (showWizard) {
    return (
      <div className="p-6">
        <button 
          onClick={() => setShowWizard(false)}
          className="mb-4 flex items-center gap-2 text-gray-500 hover:text-gray-700"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Voltar para Templates
        </button>
        <TemplateWizard onComplete={() => {
          setShowWizard(false);
          fetchTemplates();
        }} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates de Projeto</h1>
          <p className="text-gray-500">Padronize seus processos com fluxos de trabalho pré-definidos.</p>
        </div>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Criar Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Seed Templates Card */}
        <div className="bg-indigo-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden group">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
          <h3 className="text-lg font-bold mb-2">Biblioteca de Indústria</h3>
          <p className="text-indigo-100 text-sm mb-6">Importe templates otimizados para o seu nicho de mercado em segundos.</p>
          <button 
            onClick={() => setShowWizard(true)}
            className="w-full py-2.5 bg-white text-indigo-600 rounded-lg text-sm font-bold hover:bg-indigo-50 transition-colors"
          >
            Explorar Biblioteca
          </button>
        </div>

        {templates.map((template) => (
          <div 
            key={template.id}
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md hover:border-indigo-200 transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-gray-50 rounded-xl group-hover:bg-indigo-50 transition-colors">
                {getIndustryIcon(template.industry)}
              </div>
              <div className="flex items-center gap-1">
                {!template.is_default && (
                  <button 
                    onClick={() => handleSetDefault(template.id)}
                    className="px-2 py-0.5 bg-gray-50 text-gray-400 text-[10px] font-bold rounded-full border border-gray-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-colors"
                  >
                    TORNAR PADRÃO
                  </button>
                )}
                {template.is_default && (
                  <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-full border border-green-100">
                    PADRÃO
                  </span>
                )}
                <button className="p-1 text-gray-400 hover:text-gray-600">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-2">{template.name}</h3>
            <p className="text-sm text-gray-500 line-clamp-2 mb-6 h-10">
              {template.description}
            </p>

            <div className="flex items-center gap-6 mb-6">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Estágios</p>
                <p className="text-lg font-bold text-gray-900">{template.stages_count}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase">Campos</p>
                <p className="text-lg font-bold text-gray-900">{template.fields_count}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
              <button 
                onClick={() => navigate(`/admin/projects/templates/${template.id}`)}
                className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Configurar
              </button>
              <button className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                <Copy className="w-4 h-4" />
              </button>
              <button 
                onClick={() => handleDeleteTemplate(template.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {/* Create New Card */}
        <button 
          onClick={() => setShowCreateModal(true)}
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group"
        >
          <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4 group-hover:bg-indigo-100 transition-colors">
            <Plus className="w-6 h-6 text-gray-400 group-hover:text-indigo-600" />
          </div>
          <h3 className="text-sm font-bold text-gray-900">Novo Template Personalizado</h3>
          <p className="text-xs text-gray-500 mt-1">Crie um fluxo do zero para sua empresa.</p>
        </button>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Novo Template</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateTemplate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Template</label>
                <input 
                  type="text"
                  required
                  value={newTemplate.name}
                  onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ex: Fluxo de Vendas Solar"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea 
                  value={newTemplate.description}
                  onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                  placeholder="Descreva o objetivo deste template..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Indústria/Nicho</label>
                <select 
                  value={newTemplate.industry}
                  onChange={e => setNewTemplate({...newTemplate, industry: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  <option value="generic">Genérico</option>
                  <option value="solar_energy">Energia Solar</option>
                  <option value="construction">Construção Civil</option>
                  <option value="accounting">Contabilidade</option>
                  <option value="law">Advocacia</option>
                  <option value="clinic">Clínica/Saúde</option>
                  <option value="real_estate">Imobiliária</option>
                  <option value="education">Educação</option>
                  <option value="events">Eventos</option>
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
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
