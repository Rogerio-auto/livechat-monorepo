// frontend/src/pages/projects/ProjectTemplateEditor.tsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ChevronLeft, 
  Save, 
  Plus, 
  Trash2, 
  GripVertical, 
  Settings2, 
  Layout, 
  Cpu,
  CheckCircle2, 
  AlertCircle,
  Type,
  Hash,
  Calendar,
  List,
  FileText,
  DollarSign,
  ToggleLeft,
  Link,
  Mail,
  Phone
} from "lucide-react";
import { api, API } from "../../lib/api";
import { showToast } from "../../hooks/useToast";
import type { TemplateWithDetails, ProjectStage, ProjectCustomField } from "@livechat/shared";

const ProjectTemplateEditor: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<TemplateWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"stages" | "fields">("stages");

  useEffect(() => {
    fetchTemplate();
  }, [id]);

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/projects/templates/${id}`);
      setTemplate(response.data);
    } catch (error) {
      console.error("Error fetching template:", error);
      showToast("Erro ao carregar template", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!template) return;
    try {
      setSaving(true);
      await api.put(`/projects/templates/${id}`, {
        name: template.name,
        description: template.description,
        industry: template.industry,
        is_default: template.is_default
      });
      showToast("Template salvo com sucesso!", "success");
    } catch (error) {
      console.error("Error saving template:", error);
      showToast("Erro ao salvar template", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddStage = async () => {
    if (!template) return;
    const newStage = {
      name: "Novo Estágio",
      order_index: template.stages?.length || 0,
      color: "#6366f1"
    };
    try {
      await api.post(`/projects/templates/${id}/stages`, newStage);
      fetchTemplate();
      showToast("Estágio adicionado", "success");
    } catch (error) {
      console.error("Error adding stage:", error);
      showToast("Erro ao adicionar estágio", "error");
    }
  };

  const handleAddField = async () => {
    if (!template) return;
    const newField = {
      field_key: `field_${Date.now()}`,
      field_label: "Novo Campo",
      field_type: "text",
      order_index: template.custom_fields?.length || 0
    };
    try {
      await api.post(`/projects/templates/${id}/fields`, newField);
      fetchTemplate();
      showToast("Campo personalizado adicionado", "success");
    } catch (error) {
      console.error("Error adding field:", error);
      showToast("Erro ao adicionar campo", "error");
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm("Excluir este estágio?")) return;
    try {
      await api.delete(`/projects/templates/stages/${stageId}`);
      fetchTemplate();
      showToast("Estágio excluído", "success");
    } catch (error) {
      console.error("Error deleting stage:", error);
      showToast("Erro ao excluir estágio", "error");
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("Excluir este campo?")) return;
    try {
      await api.delete(`/projects/templates/fields/${fieldId}`);
      fetchTemplate();
      showToast("Campo excluído", "success");
    } catch (error) {
      console.error("Error deleting field:", error);
      showToast("Erro ao excluir campo", "error");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (!template) return <div className="text-white text-center py-12">Template não encontrado.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate("/admin/projects/templates")}
          className="flex items-center gap-2 text-slate-500 hover:text-white transition-all group font-medium"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span>Voltar para Templates</span>
        </button>
        <button 
          onClick={handleSaveTemplate}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-600 transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 active:scale-95"
        >
          <Save className="w-5 h-5" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar: General Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/40 border border-white/5 p-6 rounded-2xl backdrop-blur-md shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
                <Settings2 className="w-5 h-5" />
              </div>
              <h2 className="text-lg font-bold text-white">Informações Gerais</h2>
            </div>
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Nome do Template</label>
                <input 
                  type="text"
                  value={template.name}
                  onChange={e => setTemplate({...template, name: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/5 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="Nome do template"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Descrição</label>
                <textarea 
                  value={template.description || ""}
                  onChange={e => setTemplate({...template, description: e.target.value})}
                  className="w-full px-4 py-3 bg-slate-800 border border-white/5 rounded-xl text-white focus:ring-2 focus:ring-indigo-500 outline-none h-32 resize-none transition-all"
                  placeholder="Explique o propósito deste fluxo..."
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Indústria/Nicho</label>
                <select 
                  value={template.industry}
                  onChange={e => setTemplate({...template, industry: e.target.value})}
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
              <div className="flex items-center gap-3 p-4 bg-slate-800/50 rounded-xl border border-white/5">
                <input 
                  type="checkbox"
                  id="is_default"
                  checked={template.is_default}
                  onChange={e => setTemplate({...template, is_default: e.target.checked})}
                  className="w-5 h-5 text-indigo-500 border-white/10 bg-slate-700 rounded-lg focus:ring-indigo-500 focus:ring-offset-slate-900"
                />
                <label htmlFor="is_default" className="text-sm font-semibold text-slate-300 cursor-pointer">Definir como Padrão</label>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: Stages & Fields */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl">
            <div className="flex border-b border-white/5 bg-slate-800/20">
              <button 
                onClick={() => setActiveTab("stages")}
                className={`flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "stages" ? "text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5 shadow-inner" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
              >
                <Layout className="w-4 h-4" />
                Estágios do Kanban
              </button>
              <button 
                onClick={() => setActiveTab("fields")}
                className={`flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2 ${activeTab === "fields" ? "text-indigo-400 border-b-2 border-indigo-500 bg-indigo-500/5 shadow-inner" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
              >
                <Cpu className="w-4 h-4" />
                Campos de Dados
              </button>
            </div>

            <div className="p-8">
              {activeTab === "stages" ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Fluxo de Trabalho</h3>
                      <p className="text-xs text-slate-500">Configure as etapas de progresso do projeto.</p>
                    </div>
                    <button 
                      onClick={handleAddStage}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-400 bg-indigo-500/10 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Estágio
                    </button>
                  </div>
                  
                  {template.stages?.sort((a, b) => a.order_index - b.order_index).map((stage, index) => (
                    <div key={stage.id} className="flex items-center gap-5 p-5 bg-slate-800/40 rounded-2xl border border-white/5 group hover:border-indigo-500/30 transition-all">
                      <div className="cursor-grab text-slate-600 group-hover:text-slate-400 transition-colors">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <div className="relative">
                        <div 
                          className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" 
                          style={{ backgroundColor: stage.color || '#6366f1' }}
                        >
                          <span className="text-xs font-bold text-white/80">{index + 1}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text"
                          value={stage.name}
                          onChange={async (e) => {
                            const newStages = [...(template.stages || [])];
                            newStages[index] = { ...stage, name: e.target.value };
                            setTemplate({ ...template, stages: newStages });
                          }}
                          onBlur={async (e) => {
                            await fetch(`${API}/projects/templates/stages/${stage.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name: e.target.value }),
                              credentials: "include"
                            });
                          }}
                          className="bg-transparent font-bold text-white text-lg outline-none focus:text-indigo-400 transition-colors w-full"
                          placeholder="Nome da Etapa"
                        />
                      </div>
                      <button 
                        onClick={() => handleDeleteStage(stage.id)}
                        className="p-2.5 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Formulário de Dados</h3>
                      <p className="text-xs text-slate-500">Defina os campos que devem ser preenchidos.</p>
                    </div>
                    <button 
                      onClick={handleAddField}
                      className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-indigo-400 bg-indigo-500/10 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20 transition-all active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Campo
                    </button>
                  </div>

                  {template.custom_fields?.sort((a, b) => a.order_index - b.order_index).map((field, index) => (
                    <div key={field.id} className="p-6 bg-slate-800/40 rounded-2xl border border-white/5 group hover:border-indigo-500/30 transition-all">
                      <div className="flex flex-col md:flex-row md:items-center gap-6">
                        <div className="cursor-grab text-slate-600 group-hover:text-slate-400 transition-colors hidden md:block">
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Label de Exibição</label>
                            <input 
                              type="text"
                              value={field.field_label}
                              onChange={(e) => {
                                const newFields = [...(template.custom_fields || [])];
                                newFields[index] = { ...field, field_label: e.target.value };
                                setTemplate({ ...template, custom_fields: newFields });
                              }}
                              onBlur={async (e) => {
                                await fetch(`${API}/projects/templates/fields/${field.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ field_label: e.target.value }),
                                  credentials: "include"
                                });
                              }}
                              className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-2.5 text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                              placeholder="Título do campo"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-widest mb-2">Tipo de Dado</label>
                            <select 
                              value={field.field_type}
                              onChange={async (e) => {
                                const newType = e.target.value as any;
                                const newFields = [...(template.custom_fields || [])];
                                newFields[index] = { ...field, field_type: newType };
                                setTemplate({ ...template, custom_fields: newFields });
                                
                                await fetch(`${API}/projects/templates/fields/${field.id}`, {
                                  method: "PUT",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ field_type: newType }),
                                  credentials: "include"
                                });
                              }}
                              className="w-full bg-slate-800 border border-white/5 rounded-xl px-4 py-2.5 text-slate-400 text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all cursor-pointer"
                            >
                              <option value="text">Texto Curto</option>
                              <option value="textarea" className="bg-slate-900">Texto Longo</option>
                              <option value="number" className="bg-slate-900">Número</option>
                              <option value="currency" className="bg-slate-900">Moeda</option>
                              <option value="date" className="bg-slate-900">Data</option>
                              <option value="select" className="bg-slate-900">Seleção Única</option>
                              <option value="boolean" className="bg-slate-900">Sim/Não</option>
                            </select>
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button 
                            onClick={() => handleDeleteField(field.id)}
                            className="p-3 text-slate-600 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectTemplateEditor;

