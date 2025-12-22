import React, { useState } from 'react';
import { FiArrowLeft, FiArrowRight, FiCheck, FiX } from 'react-icons/fi';
import { MetaHeaderBuilder } from './MetaHeaderBuilder';
import { MetaBodyBuilder } from './MetaBodyBuilder';
import { MetaButtonsBuilder } from './MetaButtonsBuilder';
import { MetaTemplatePreview } from './MetaTemplatePreview';
import type { HeaderComponent, BodyComponent, ButtonComponent, MetaTemplateData } from './MetaTemplateTypes';

export type { HeaderComponent, BodyComponent, ButtonComponent, MetaTemplateData };

interface Inbox {
  id: string;
  name: string;
  provider: string;
}

interface MetaTemplateWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (template: MetaTemplateData, inboxId: string) => Promise<void>;
  inboxes: Inbox[];
  preSelectedInboxId?: string; // Nova prop opcional
}

const STEP_TITLES = ['Informações Básicas', 'Cabeçalho', 'Corpo', 'Rodapé & Botões'];

export const MetaTemplateWizard: React.FC<MetaTemplateWizardProps> = ({
  isOpen,
  onClose,
  onSubmit,
  inboxes,
  preSelectedInboxId
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Basic Info
  const [selectedInboxId, setSelectedInboxId] = useState(preSelectedInboxId || '');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<'MARKETING' | 'UTILITY' | 'AUTHENTICATION'>('MARKETING');
  const [language, setLanguage] = useState('pt_BR');

  // Step 2: Header
  const [header, setHeader] = useState<HeaderComponent | undefined>(undefined);

  // Step 3: Body
  const [body, setBody] = useState<BodyComponent>({ text: '' });

  // Step 4: Footer & Buttons
  const [footer, setFooter] = useState('');
  const [buttons, setButtons] = useState<ButtonComponent[]>([]);

  const resetForm = () => {
    setCurrentStep(0);
    setSelectedInboxId('');
    setName('');
    setCategory('MARKETING');
    setLanguage('pt_BR');
    setHeader(undefined);
    setBody({ text: '' });
    setFooter('');
    setButtons([]);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateStep = (step: number): string | null => {
    switch (step) {
      case 0:
        if (!selectedInboxId) return 'Selecione uma inbox';
        if (!name.trim()) return 'Nome é obrigatório';
        if (!/^[a-z0-9_]+$/.test(name)) return 'Nome deve conter apenas letras minúsculas, números e underscore';
        if (!category) return 'Categoria é obrigatória';
        if (!language) return 'Idioma é obrigatório';
        return null;
      case 1:
        // Header is optional
        if (header && header.type === 'TEXT' && !header.text?.trim()) {
          return 'Se escolher cabeçalho de texto, o conteúdo é obrigatório';
        }
        return null;
      case 2:
        if (!body.text.trim()) return 'Corpo da mensagem é obrigatório';
        return null;
      case 3:
        // Validate buttons
        for (const btn of buttons) {
          if (!btn.text.trim()) return 'Texto do botão é obrigatório';
          if (btn.type === 'PHONE_NUMBER' && !btn.phone_number) return 'Número de telefone é obrigatório';
          if (btn.type === 'URL' && !btn.url) return 'URL é obrigatória';
        }
        return null;
      default:
        return null;
    }
  };

  const handleNext = () => {
    const error = validateStep(currentStep);
    if (error) {
      setError(error);
      return;
    }
    setError('');
    if (currentStep < STEP_TITLES.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    setError('');
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async () => {
    const error = validateStep(currentStep);
    if (error) {
      setError(error);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const templateData: MetaTemplateData = {
        name,
        category,
        language,
        header: header && (header.text || header.type !== 'TEXT') ? header : undefined,
        body,
        footer: footer.trim() || undefined,
        buttons: buttons.length > 0 ? buttons : undefined
      };

      await onSubmit(templateData, selectedInboxId);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar template');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Criar Template Meta WhatsApp
            </h2>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <FiX className="w-5 h-5" />
            </button>
          </div>

          {/* Steps Progress */}
          <div className="flex items-center gap-2">
            {STEP_TITLES.map((title, idx) => (
              <React.Fragment key={idx}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      idx === currentStep
                        ? 'bg-blue-600 text-white'
                        : idx < currentStep
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {idx < currentStep ? <FiCheck className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={`text-sm font-medium ${
                      idx === currentStep
                        ? 'text-blue-600'
                        : idx < currentStep
                        ? 'text-green-600'
                        : 'text-gray-500'
                    }`}
                  >
                    {title}
                  </span>
                </div>
                {idx < STEP_TITLES.length - 1 && (
                  <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-700 mx-2" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Body - Split View */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Form */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Step 0: Basic Info */}
            {currentStep === 0 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Inbox WhatsApp *
                  </label>
                  <select
                    value={selectedInboxId}
                    onChange={(e) => setSelectedInboxId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="">Selecione uma inbox</option>
                    {inboxes.map((inbox) => (
                      <option key={inbox.id} value={inbox.id}>
                        {inbox.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Template será criado nesta conta WhatsApp Business
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome do Template *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value.toLowerCase())}
                    placeholder="ex: boas_vindas_2024"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Apenas letras minúsculas, números e underscore (_)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Categoria *
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'MARKETING', label: 'Marketing', desc: 'Promoções, ofertas' },
                      { value: 'UTILITY', label: 'Utilitário', desc: 'Notificações, lembretes' },
                      { value: 'AUTHENTICATION', label: 'Autenticação', desc: 'Códigos OTP' }
                    ].map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => setCategory(cat.value as any)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          category === cat.value
                            ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                        }`}
                      >
                        <div className="font-medium text-sm">{cat.label}</div>
                        <div className="text-xs text-gray-500 mt-1">{cat.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Idioma *
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  >
                    <option value="pt_BR">Português (Brasil)</option>
                    <option value="en_US">English (US)</option>
                    <option value="es_ES">Español (España)</option>
                    <option value="es_MX">Español (México)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Step 1: Header */}
            {currentStep === 1 && (
              <MetaHeaderBuilder
                header={header}
                onChange={setHeader}
              />
            )}

            {/* Step 2: Body */}
            {currentStep === 2 && (
              <MetaBodyBuilder
                body={body}
                onChange={setBody}
              />
            )}

            {/* Step 3: Footer & Buttons */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Rodapé (Opcional)
                  </label>
                  <input
                    type="text"
                    value={footer}
                    onChange={(e) => setFooter(e.target.value)}
                    placeholder="Texto pequeno no rodapé"
                    maxLength={60}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                  />
                  <p className="mt-1 text-xs text-gray-500">Máximo 60 caracteres</p>
                </div>

                <MetaButtonsBuilder
                  buttons={buttons}
                  onChange={setButtons}
                  category={category}
                />
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-6">
            <MetaTemplatePreview
              header={header}
              body={body}
              footer={footer}
              buttons={buttons}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <FiArrowLeft className="w-4 h-4" />
            Voltar
          </button>

          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancelar
            </button>

            {currentStep < STEP_TITLES.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
              >
                Próximo
                <FiArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Criando...' : 'Criar Template'}
                <FiCheck className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetaTemplateWizard;

