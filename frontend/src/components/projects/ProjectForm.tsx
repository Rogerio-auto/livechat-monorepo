// frontend/src/components/projects/ProjectForm.tsx

import { useState } from "react";
import { fetchJson } from "../../lib/fetch";
import type { TemplateWithDetails, Project, ProjectCustomField } from "../../types/projects";
import { Button } from "../ui/Button";

const API = import.meta.env.VITE_API_URL;

type Props = {
  template: TemplateWithDetails;
  project?: Project;
  onClose:  () => void;
  onSuccess: () => void;
};

export default function ProjectForm({ template, project, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: project?.title || '',
    description: project?.description || '',
    customer_name: project?.customer_name || '',
    customer_email: project?.customer_email || '',
    customer_phone: project?.customer_phone || '',
    estimated_value:  project?.estimated_value || '',
    start_date: project?.start_date || '',
    estimated_end_date: project?.estimated_end_date || '',
    priority: project?.priority || 'medium',
    custom_fields: project?.custom_fields || {},
  });

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
    } catch (err:  any) {
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 livechat-theme">
      <div className="bg-[color:var(--color-surface)] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-[color:var(--color-border)]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[color:var(--color-border)]">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[color:var(--color-text)]">
              {project ? 'Editar Projeto' : 'Novo Projeto'}
            </h2>
            <button
              onClick={onClose}
              className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-[color:var(--color-text-muted)] mt-1">
            {template.icon} {template.name}
          </p>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 bg-[color:var(--color-bg)]">
          {error && (
            <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500">
              ⚠️ {error}
            </div>
          )}

          <div className="space-y-6">
            {/* Informações Básicas */}
            <section>
              <h3 className="text-lg font-semibold text-[color:var(--color-text)] mb-4">
                Informações Básicas
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[color:var(--color-text-muted)] mb-2">
                    Título do Projeto <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className="w-full px-4 py-2 border border-[color:var(--color-border)] rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none"
                    placeholder="Ex: Sistema Fotovoltaico 10kWp"
                    required
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[color:var(--color-text-muted)] mb-2">
                    Descrição
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    className="w-full px-4 py-2 border border-[color:var(--color-border)] rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none"
                    rows={3}
                    placeholder="Descreva o projeto..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[color:var(--color-text-muted)] mb-2">
                    Valor Estimado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.estimated_value}
                    onChange={(e) => updateField('estimated_value', e.target.value)}
                    className="w-full px-4 py-2 border border-[color:var(--color-border)] rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none"
                    placeholder="0,00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[color:var(--color-text-muted)] mb-2">
                    Prioridade
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => updateField('priority', e.target.value)}
                    className="w-full px-4 py-2 border border-[color:var(--color-border)] rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[color:var(--color-text-muted)] mb-2">
                    Data de Início
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => updateField('start_date', e.target.value)}
                    className="w-full px-4 py-2 border border-[color:var(--color-border)] rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[color:var(--color-text-muted)] mb-2">
                    Previsão de Término
                  </label>
                  <input
                    type="date"
                    value={formData.estimated_end_date}
                    onChange={(e) => updateField('estimated_end_date', e.target.value)}
                    className="w-full px-4 py-2 border border-[color:var(--color-border)] rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none"
                  />
                </div>
              </div>
            </section>

            {/* Informações do Cliente */}
            <section>
              <h3 className="text-lg font-semibold text-[color:var(--color-text)] mb-4">
                Informações do Cliente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[color:var(--color-text-muted)] mb-2">
                    Nome do Cliente
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => updateField('customer_name', e.target.value)}
                    className="w-full px-4 py-2 border border-[color:var(--color-border)] rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none"
                    placeholder="Nome completo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[color:var(--color-text-muted)] mb-2">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => updateField('customer_phone', e.target.value)}
                    className="w-full px-4 py-2 border border-[color:var(--color-border)] rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-[color:var(--color-text-muted)] mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => updateField('customer_email', e.target.value)}
                    className="w-full px-4 py-2 border border-[color:var(--color-border)] rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            </section>

            {/* Campos Customizados */}
            {template.custom_fields?.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold text-[color:var(--color-text)] mb-4">
                  Informações Específicas
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {template.custom_fields.map((field) => (
                    <CustomFieldInput
                      key={field.id}
                      field={field}
                      value={formData.custom_fields[field.field_key]}
                      onChange={(value) => updateCustomField(field.field_key, value)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[color:var(--color-border)] flex justify-end gap-3 bg-[color:var(--color-surface)]">
          <button 
            onClick={onClose} 
            disabled={loading}
            className="px-4 py-2 text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] transition-colors"
          >
            Cancelar
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={loading}
            className="px-6 py-2 bg-[color:var(--color-primary)] text-white rounded-lg hover:opacity-90 transition-all font-bold disabled:opacity-50"
          >
            {loading ? 'Salvando...' : project ? 'Salvar Alterações' : 'Criar Projeto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== CUSTOM FIELD INPUT ====================

type CustomFieldInputProps = {
  field: ProjectCustomField;
  value: any;
  onChange: (value:  any) => void;
};

function CustomFieldInput({ field, value, onChange }: CustomFieldInputProps) {
  const baseClass = "w-full px-4 py-2 border border-[color:var(--color-border)] rounded-lg bg-[color:var(--color-surface)] text-[color:var(--color-text)] focus:ring-2 focus:ring-[color:var(--color-primary)] outline-none";

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
            step={field.field_type === 'currency' ?  '0.01' : 'any'}
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
          <select
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
            required={field.is_required}
          >
            <option value="">Selecione...</option>
            {field.field_options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={value || false}
              onChange={(e) => onChange(e.target.checked)}
              className="w-5 h-5 text-[color:var(--color-primary)] border-[color:var(--color-border)] rounded focus:ring-[color:var(--color-primary)]"
            />
            <span className="text-sm text-[color:var(--color-text-muted)]">
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
            placeholder={field.field_placeholder || ''}
            required={field.is_required}
          />
        );
    }
  };

  const colSpan = field.field_type === 'textarea' ? 'md:col-span-2' :  '';

  return (
    <div className={colSpan}>
      <label className="block text-sm font-medium text-[color:var(--color-text-muted)] mb-2">
        {field.field_label}
        {field.is_required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {renderInput()}
      {field.field_help_text && (
        <p className="text-xs text-[color:var(--color-text-muted)] opacity-60 mt-1">
          {field.field_help_text}
        </p>
      )}
    </div>
  );
}
