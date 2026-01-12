// frontend/src/components/projects/ProjectForm.tsx

import { useState, useEffect } from "react";
import { fetchJson } from "../../lib/fetch";
import type { TemplateWithDetails, Project, ProjectCustomField } from "@livechat/shared";
import { Search, Calendar, AlertCircle, CheckCircle2, Layout, ArrowRight, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const API = import.meta.env.VITE_API_URL;

type Props = {
  template: TemplateWithDetails;
  project?: Project;
  onClose: () => void;
  onSuccess: () => void;
  isModal?: boolean;
};

export default function ProjectForm({ template, project, onClose, onSuccess, isModal = true }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: project?.title || '',
    description: project?.description || '',
    customer_name: project?.customer_name || '',
    customer_email: project?.customer_email || '',
    customer_phone: project?.customer_phone || '',
    estimated_value: project?.estimated_value || '',
    start_date: project?.start_date || '',
    estimated_end_date: project?.estimated_end_date || '',
    priority: project?.priority || 'medium',
    custom_fields: project?.custom_fields || {},
  });

  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [showLeadSuggestions, setShowLeadSuggestions] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any | null>(null);

  useEffect(() => {
    fetchJson<any[]>(`${API}/leads`).then(setAllLeads).catch(console.error);
  }, []);

  const handleSelectLead = async (lead: any) => {
    setSelectedLead(lead);
    updateField('customer_name', lead.name);
    updateField('customer_email', lead.email || '');
    setShowLeadSuggestions(false);

    if (lead.customer_id) {
      try {
        const customer = await fetchJson<any>(`${API}/customers/${lead.customer_id}`);
        if (customer && customer.phone) {
          updateField('customer_phone', customer.phone);
        } else {
          updateField('customer_phone', lead.phone || '');
        }
      } catch (error) {
        console.error("Error fetching customer:", error);
        updateField('customer_phone', lead.phone || '');
      }
    } else {
      updateField('customer_phone', lead.phone || '');
    }
  };

  const handleClearLead = () => {
    setSelectedLead(null);
    updateField('customer_name', '');
    updateField('customer_email', '');
    updateField('customer_phone', '');
  };

  const filteredLeads = allLeads.filter(l =>
    (l.name?.toLowerCase() || "").includes(formData.customer_name.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        template_id: template.id,
        title: formData.title,
        description: formData.description || null,
        customer_name: formData.customer_name || null,
        customer_email: formData.customer_email || null,
        customer_phone: formData.customer_phone || null,
        priority: formData.priority,
        start_date: formData.start_date || null,
        estimated_end_date: formData.estimated_end_date || null,
        estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value as any) : null,
        custom_fields: formData.custom_fields,
      };

      if (project) {
        await fetchJson(`${API}/projects/${project.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await fetchJson(`${API}/projects`, {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar projeto');
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateCustomField = (key: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      custom_fields: { ...prev.custom_fields, [key]: value },
    }));
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-emerald-500";
      default: return "bg-slate-400";
    }
  };

  const formContent = (
    <div className={`${isModal ? 'p-8' : 'w-full'}`}>
      {/* Header */}
      {!isModal && (
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{project ? 'Editar Projeto' : 'Configuração do Projeto'}</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400">
            {project 
              ? <>Edite as informações do projeto baseado no template <span className="font-bold text-emerald-600 dark:text-emerald-400">{template.name}</span>.</>
              : <>Preencha as informações abaixo para iniciar um novo projeto baseado no template <span className="font-bold text-emerald-600 dark:text-emerald-400">{template.name}</span>.</>
            }
          </p>
        </div>
      )}

      <div className={`grid grid-cols-1 ${!isModal ? 'gap-12' : 'gap-8'}`}>
        {/* Form */}
        <div className="space-y-10">
          <form id="project-form" onSubmit={handleSubmit}>
            {error && (
              <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{error}</span>
              </div>
            )}

            {/* Section: Basic Info */}
            <div className="border-b border-slate-100 dark:border-slate-800 pb-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <Layout className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Informações Principais</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Dados essenciais para identificação do projeto.</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Título do Projeto
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
                    placeholder="Ex: Instalação Solar - Residência Silva"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
                    rows={4}
                    placeholder="Descreva os detalhes e objetivos deste projeto..."
                  />
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">Breve resumo do escopo do projeto.</p>
                </div>
              </div>
            </div>

            {/* Section: Client */}
            <div className="border-b border-slate-100 dark:border-slate-800 py-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Search className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Cliente</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Vincule este projeto a um cliente ou lead existente.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Buscar Cliente
                  </label>
                  
                  {selectedLead ? (
                    <div className="flex items-center justify-between p-5 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/50 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-lg">
                          {selectedLead.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{selectedLead.name}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{formData.customer_phone}</span>
                            {formData.customer_email && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                <span>{formData.customer_email}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearLead}
                        className="text-slate-400 hover:text-red-500 transition-colors p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl"
                        title="Remover cliente"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.customer_name}
                          onChange={(e) => {
                            updateField('customer_name', e.target.value);
                            setShowLeadSuggestions(true);
                          }}
                          onFocus={() => setShowLeadSuggestions(true)}
                          onBlur={() => setTimeout(() => setShowLeadSuggestions(false), 200)}
                          className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
                          placeholder="Digite o nome do cliente..."
                          autoComplete="off"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                      </div>
                      
                      {showLeadSuggestions && formData.customer_name && (
                        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-md max-h-64 overflow-y-auto py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                          {filteredLeads.length > 0 ? (
                            filteredLeads.map(lead => (
                              <button
                                key={lead.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectLead(lead);
                                }}
                                className="w-full text-left px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                              >
                                <div className="font-bold text-slate-900 dark:text-white">{lead.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{lead.phone} {lead.email ? `• ${lead.email}` : ''}</div>
                              </button>
                            ))
                          ) : (
                            <div className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400 italic text-center">Nenhum cliente encontrado</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section: Details */}
            <div className="border-b border-slate-100 dark:border-slate-800 py-10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Detalhes Operacionais</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Defina prazos, valores e prioridade.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estimated_value}
                    onChange={(e) => updateField('estimated_value', e.target.value)}
                    className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Prioridade
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => updateField('priority', e.target.value)}
                    className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-bold appearance-none cursor-pointer"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => updateField('start_date', e.target.value)}
                    className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Previsão de Término
                  </label>
                  <input
                    type="date"
                    value={formData.estimated_end_date}
                    onChange={(e) => updateField('estimated_end_date', e.target.value)}
                    className="w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Section: Custom Fields */}
            {template.custom_fields?.length > 0 && (
              <div className="py-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Informações Específicas</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Campos personalizados do template {template.name}.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {template.custom_fields.map((field) => (
                    <CustomFieldInput
                      key={field.id}
                      field={field}
                      value={formData.custom_fields[field.field_key]}
                      onChange={(value) => updateCustomField(field.field_key, value)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-4 pt-10">
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3 text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-10 py-3 bg-emerald-600 text-white text-sm font-bold rounded-lg hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-100 dark:focus:ring-emerald-900/20 transition-all shadow-md shadow-emerald-200 dark:shadow-none disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {project ? 'Salvando...' : 'Criando...'}
                  </>
                ) : (
                  <>
                    {project ? 'Salvar Alterações' : 'Criar Projeto'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
        <div className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-xl shadow-md overflow-y-auto relative border border-slate-100 dark:border-slate-800">
           <button 
             onClick={onClose} 
             className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors z-10"
           >
             <X className="w-6 h-6" />
           </button>
           {formContent}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {formContent}
    </div>
  );
}

// ==================== CUSTOM FIELD INPUT ====================

type CustomFieldInputProps = {
  field: ProjectCustomField;
  value: any;
  onChange: (value: any) => void;
};

function CustomFieldInput({ field, value, onChange }: CustomFieldInputProps) {
  const baseClass = "w-full px-5 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all font-medium";

  const renderInput = () => {
    switch (field.field_type) {
      case 'text':
      case 'email':
      case 'url':
      case 'phone':
        return (
          <input
            type={field.field_type === 'email' ? 'email' : field.field_type === 'url' ? 'url' : 'text'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            placeholder={field.field_placeholder || ''}
            required={field.is_required}
          />
        );

      case 'number':
      case 'currency':
        return (
          <input
            type="number"
            step={field.field_type === 'currency' ? '0.01' : 'any'}
            value={value || ''}
            onChange={(e) => onChange(parseFloat(e.target.value) || null)}
            className={baseClass}
            placeholder={field.field_placeholder || ''}
            required={field.is_required}
            min={field.min_value || undefined}
            max={field.max_value || undefined}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            required={field.is_required}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            required={field.is_required}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            placeholder={field.field_placeholder || ''}
            required={field.is_required}
            rows={3}
          />
        );

      case 'select':
        return (
          <>
            <input
              type="text"
              list={`list-${field.id}`}
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              className={baseClass}
              placeholder={field.field_placeholder || 'Selecione ou digite...'}
              required={field.is_required}
            />
            {field.field_options && field.field_options.length > 0 && (
              <datalist id={`list-${field.id}`}>
                {field.field_options.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            )}
          </>
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-3 p-4 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/50">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="w-6 h-6 text-emerald-600 rounded focus:ring-emerald-500 border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300 font-bold">
              {field.field_placeholder || 'Sim'}
            </span>
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            required={field.is_required}
          />
        );
    }
  };

  return (
    <div>
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
        {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
      </label>
      {renderInput()}
    </div>
  );
}

