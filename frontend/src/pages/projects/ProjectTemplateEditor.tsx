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
import type { TemplateWithDetails, ProjectStage, ProjectCustomField } from "../../types/projects";

const API = import.meta.env.VITE_API_URL;

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
      const response = await fetch(`${API}/projects/templates/${id}`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setTemplate(data);
      }
    } catch (error) {
      console.error("Error fetching template:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!template) return;
    try {
      setSaving(true);
      const response = await fetch(`${API}/projects/templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          industry: template.industry,
          is_default: template.is_default
        }),
        credentials: "include"
      });
      if (response.ok) {
        // Success toast or notification
      }
    } catch (error) {
      console.error("Error saving template:", error);
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
      const response = await fetch(`${API}/projects/templates/${id}/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStage),
        credentials: "include"
      });
      if (response.ok) {
        fetchTemplate();
      }
    } catch (error) {
      console.error("Error adding stage:", error);
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
      const response = await fetch(`${API}/projects/templates/${id}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newField),
        credentials: "include"
      });
      if (response.ok) {
        fetchTemplate();
      }
    } catch (error) {
      console.error("Error adding field:", error);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!confirm("Excluir este estágio?")) return;
    try {
      const response = await fetch(`${API}/projects/templates/stages/${stageId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (response.ok) {
        fetchTemplate();
      }
    } catch (error) {
      console.error("Error deleting stage:", error);
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    if (!confirm("Excluir este campo?")) return;
    try {
      const response = await fetch(`${API}/projects/templates/fields/${fieldId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (response.ok) {
        fetchTemplate();
      }
    } catch (error) {
      console.error("Error deleting field:", error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!template) return <div>Template não encontrado.</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <button 
          onClick={() => navigate("/admin/projects/templates")}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors group"
        >
          <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Voltar para Templates</span>
        </button>
        <button 
          onClick={handleSaveTemplate}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          {saving ? "Salvando..." : "Salvar Alterações"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Sidebar: General Info */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Informações Gerais</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Nome do Template</label>
                <input 
                  type="text"
                  value={template.name}
                  onChange={e => setTemplate({...template, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Descrição</label>
                <textarea 
                  value={template.description || ""}
                  onChange={e => setTemplate({...template, description: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-24 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Indústria</label>
                <select 
                  value={template.industry}
                  onChange={e => setTemplate({...template, industry: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
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
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="is_default"
                  checked={template.is_default}
                  onChange={e => setTemplate({...template, is_default: e.target.checked})}
                  className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                />
                <label htmlFor="is_default" className="text-sm font-medium text-gray-700">Template Padrão</label>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: Stages & Fields */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex border-b border-gray-100">
              <button 
                onClick={() => setActiveTab("stages")}
                className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === "stages" ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30" : "text-gray-500 hover:bg-gray-50"}`}
              >
                Estágios do Kanban
              </button>
              <button 
                onClick={() => setActiveTab("fields")}
                className={`flex-1 py-4 text-sm font-bold transition-colors ${activeTab === "fields" ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/30" : "text-gray-500 hover:bg-gray-50"}`}
              >
                Campos Personalizados
              </button>
            </div>

            <div className="p-6">
              {activeTab === "stages" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">Fluxo de Trabalho</h3>
                    <button 
                      onClick={handleAddStage}
                      className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Estágio
                    </button>
                  </div>
                  
                  {template.stages?.sort((a, b) => a.order_index - b.order_index).map((stage, index) => (
                    <div key={stage.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100 group">
                      <div className="cursor-grab text-gray-300 group-hover:text-gray-400">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }}></div>
                      <div className="flex-1">
                        <input 
                          type="text"
                          value={stage.name}
                          onChange={async (e) => {
                            // Local update for UI responsiveness
                            const newStages = [...(template.stages || [])];
                            newStages[index] = { ...stage, name: e.target.value };
                            setTemplate({ ...template, stages: newStages });
                          }}
                          onBlur={async (e) => {
                            // API update on blur
                            await fetch(`${API}/projects/templates/stages/${stage.id}`, {
                              method: "PUT",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ name: e.target.value }),
                              credentials: "include"
                            });
                          }}
                          className="bg-transparent font-bold text-gray-900 outline-none focus:ring-b-2 focus:ring-indigo-500 w-full"
                        />
                      </div>
                      <button 
                        onClick={() => handleDeleteStage(stage.id)}
                        className="p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">Campos de Dados</h3>
                    <button 
                      onClick={handleAddField}
                      className="flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Campo
                    </button>
                  </div>

                  {template.custom_fields?.sort((a, b) => a.order_index - b.order_index).map((field, index) => (
                    <div key={field.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 group">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="cursor-grab text-gray-300 group-hover:text-gray-400">
                          <GripVertical className="w-5 h-5" />
                        </div>
                        <div className="flex-1 grid grid-cols-2 gap-4">
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
                            className="bg-transparent font-bold text-gray-900 outline-none focus:ring-b-2 focus:ring-indigo-500"
                            placeholder="Label do Campo"
                          />
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
                            className="bg-transparent text-sm text-gray-500 outline-none"
                          >
                            <option value="text">Texto Curto</option>
                            <option value="textarea">Texto Longo</option>
                            <option value="number">Número</option>
                            <option value="currency">Moeda</option>
                            <option value="date">Data</option>
                            <option value="select">Seleção Única</option>
                            <option value="boolean">Sim/Não</option>
                          </select>
                        </div>
                        <button 
                          onClick={() => handleDeleteField(field.id)}
                          className="p-2 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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

