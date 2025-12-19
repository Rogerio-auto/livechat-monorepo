// frontend/src/components/projects/ProjectForm.tsx

import { useState, useEffect } from "react";
import { fetchJson } from "../../lib/fetch";
import type { TemplateWithDetails, Project, ProjectCustomField } from "../../types/projects";
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
      case "medium": return "bg-[color:var(--color-primary)]";
      default: return "bg-[color:var(--color-text-muted)]";
    }
  };

  const formContent = (
    <div className={`${isModal ? 'p-6' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12'}`}>
      {/* Header */}
      {!isModal && (
        <div className="mb-10">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <span>Projetos</span>
            <span>/</span>
            <span className="text-gray-900 font-medium">{project ? 'Editar Projeto' : 'Novo Projeto'}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{project ? 'Editar Projeto' : 'Configuração do Projeto'}</h1>
          <p className="mt-2 text-gray-600">
            {project 
              ? <>Edite as informações do projeto baseado no template <span className="font-semibold text-indigo-600">{template.name}</span>.</>
              : <>Preencha as informações abaixo para iniciar um novo projeto baseado no template <span className="font-semibold text-indigo-600">{template.name}</span>.</>
            }
          </p>
        </div>
      )}

      <div className={`grid grid-cols-1 ${!isModal ? 'lg:grid-cols-3 gap-12' : 'gap-6'}`}>
        {/* Left Column - Form */}
        <div className={`${!isModal ? 'lg:col-span-2' : ''} space-y-10`}>
          <form id="project-form" onSubmit={handleSubmit}>
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
                <AlertCircle className="w-5 h-5" />
                <span>{error}</span>
              </div>
            )}

            {/* Section: Basic Info */}
            <div className="border-b border-gray-200 pb-10">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Informações Principais</h2>
              <p className="text-sm text-gray-500 mb-6">Dados essenciais para identificação do projeto.</p>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Título do Projeto
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="Ex: Instalação Solar - Residência Silva"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    rows={4}
                    placeholder="Descreva os detalhes e objetivos deste projeto..."
                  />
                  <p className="mt-1 text-xs text-gray-500">Breve resumo do escopo do projeto.</p>
                </div>
              </div>
            </div>

            {/* Section: Client */}
            <div className="border-b border-gray-200 py-10">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Cliente</h2>
              <p className="text-sm text-gray-500 mb-6">Vincule este projeto a um cliente ou lead existente.</p>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buscar Cliente
                  </label>
                  
                  {selectedLead ? (
                    <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                          {selectedLead.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900">{selectedLead.name}</div>
                          <div className="text-sm text-gray-500 flex items-center gap-2">
                            <span>{formData.customer_phone}</span>
                            {formData.customer_email && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                                <span>{formData.customer_email}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearLead}
                        className="text-gray-400 hover:text-red-500 transition-colors p-2"
                        title="Remover cliente"
                      >
                        ✕
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
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                          placeholder="Digite o nome do cliente..."
                          autoComplete="off"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                      </div>
                      
                      {showLeadSuggestions && formData.customer_name && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                          {filteredLeads.length > 0 ? (
                            filteredLeads.map(lead => (
                              <button
                                key={lead.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectLead(lead);
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0 transition-colors"
                              >
                                <div className="font-medium text-gray-900">{lead.name}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{lead.phone} {lead.email ? `• ${lead.email}` : ''}</div>
                              </button>
                            ))
                          ) : (
                            <div className="px-4 py-3 text-sm text-gray-500">Nenhum cliente encontrado</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Section: Details */}
            <div className="border-b border-gray-200 py-10">
              <h2 className="text-lg font-semibold text-gray-900 mb-1">Detalhes Operacionais</h2>
              <p className="text-sm text-gray-500 mb-6">Defina prazos, valores e prioridade.</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estimated_value}
                    onChange={(e) => updateField('estimated_value', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prioridade
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => updateField('priority', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all bg-white"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => updateField('start_date', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Previsão de Término
                  </label>
                  <input
                    type="date"
                    value={formData.estimated_end_date}
                    onChange={(e) => updateField('estimated_end_date', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Section: Custom Fields */}
            {template.custom_fields?.length > 0 && (
              <div className="py-10">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Informações Específicas</h2>
                <p className="text-sm text-gray-500 mb-6">Campos personalizados do template {template.name}.</p>
                
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

            <div className="flex items-center justify-end gap-4 pt-6">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-100 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
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

        {/* Right Column - Preview */}
        <div className={`hidden ${!isModal ? 'lg:block' : ''}`}>
          <div className="sticky top-8 space-y-8">
            
            {/* Template Info Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Template Selecionado</h3>
              <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
                  <Layout className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{template.name}</h4>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">{template.description}</p>
                </div>
              </div>
              <div className="mt-6 flex items-center gap-3 text-xs font-medium text-gray-500">
                <span className="bg-gray-100 px-2.5 py-1 rounded-md">{template.stages_count || 0} Estágios</span>
                <span className="bg-gray-100 px-2.5 py-1 rounded-md">{template.fields_count || 0} Campos</span>
              </div>
            </div>

            {/* Preview Card */}
            <div>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Pré-visualização
              </h3>
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-lg transform scale-100 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider text-white ${getPriorityColor(formData.priority)}`}>
                    {formData.priority}
                  </div>
                </div>

                <h4 className="font-bold text-gray-900 mb-2 line-clamp-2">
                  {formData.title || "Título do Projeto"}
                </h4>
                
                <p className="text-sm text-gray-500 line-clamp-2 mb-4 min-h-[2.5rem]">
                  {formData.description || "A descrição do projeto aparecerá aqui..."}
                </p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-medium">
                      {formData.estimated_end_date 
                        ? format(new Date(formData.estimated_end_date), "dd MMM", { locale: ptBR }) 
                        : "Prazo"}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {selectedLead && (
                      <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-600" title={selectedLead.name}>
                        {selectedLead.name.charAt(0)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-center text-gray-400 mt-3">
                É assim que o projeto aparecerá no quadro Kanban.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-y-auto relative">
           <button 
             onClick={onClose} 
             className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors z-10"
           >
             <X className="w-5 h-5" />
           </button>
           {formContent}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-white">
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
  const baseClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all";

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
            {field.options && field.options.length > 0 && (
              <datalist id={`list-${field.id}`}>
                {field.options.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            )}
          </>
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50">
            <input
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300"
            />
            <span className="text-sm text-gray-700 font-medium">
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
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
      </label>
      {renderInput()}
    </div>
  );
}
