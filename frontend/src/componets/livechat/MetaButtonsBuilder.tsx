import React from 'react';
import { FiPlus, FiX, FiPhone, FiLink, FiCopy, FiMessageCircle } from 'react-icons/fi';
import { ButtonComponent } from './MetaTemplateTypes';

interface MetaButtonsBuilderProps {
  buttons: ButtonComponent[];
  onChange: (buttons: ButtonComponent[]) => void;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
}

export const MetaButtonsBuilder: React.FC<MetaButtonsBuilderProps> = ({
  buttons,
  onChange,
  category
}) => {
  const handleAddButton = (type: ButtonComponent['type']) => {
    if (buttons.length >= 10) return;

    // Limites por tipo
    const quickReplyCount = buttons.filter(b => b.type === 'QUICK_REPLY').length;
    const callToActionCount = buttons.filter(b => b.type === 'PHONE_NUMBER' || b.type === 'URL').length;
    const copyCodeCount = buttons.filter(b => b.type === 'COPY_CODE').length;

    if (type === 'QUICK_REPLY' && quickReplyCount >= 3) {
      alert('Máximo de 3 botões de resposta rápida');
      return;
    }
    if ((type === 'PHONE_NUMBER' || type === 'URL') && callToActionCount >= 2) {
      alert('Máximo de 2 botões de call-to-action');
      return;
    }
    if (type === 'COPY_CODE' && copyCodeCount >= 1) {
      alert('Máximo de 1 botão de copiar código');
      return;
    }

    const newButton: ButtonComponent = {
      type,
      text: '',
      ...(type === 'PHONE_NUMBER' && { phone_number: '' }),
      ...(type === 'URL' && { url: '', example: [''] }),
      ...(type === 'COPY_CODE' && { example: [''] })
    };

    onChange([...buttons, newButton]);
  };

  const handleRemoveButton = (index: number) => {
    onChange(buttons.filter((_, i) => i !== index));
  };

  const handleUpdateButton = (index: number, updates: Partial<ButtonComponent>) => {
    const newButtons = [...buttons];
    newButtons[index] = { ...newButtons[index], ...updates };
    onChange(newButtons);
  };

  const quickReplyCount = buttons.filter(b => b.type === 'QUICK_REPLY').length;
  const callToActionCount = buttons.filter(b => b.type === 'PHONE_NUMBER' || b.type === 'URL').length;
  const copyCodeCount = buttons.filter(b => b.type === 'COPY_CODE').length;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Botões Interativos
        </label>

        {/* Add Button Types */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            onClick={() => handleAddButton('QUICK_REPLY')}
            disabled={quickReplyCount >= 3 || buttons.length >= 10}
            className="flex items-center gap-2 p-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <FiMessageCircle className="w-4 h-4" />
            <div className="text-left flex-1">
              <div className="text-sm font-medium">Resposta Rápida</div>
              <div className="text-xs text-gray-500">{quickReplyCount}/3</div>
            </div>
          </button>

          <button
            onClick={() => handleAddButton('PHONE_NUMBER')}
            disabled={callToActionCount >= 2 || buttons.length >= 10}
            className="flex items-center gap-2 p-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <FiPhone className="w-4 h-4" />
            <div className="text-left flex-1">
              <div className="text-sm font-medium">Ligar</div>
              <div className="text-xs text-gray-500">{callToActionCount}/2 CTA</div>
            </div>
          </button>

          <button
            onClick={() => handleAddButton('URL')}
            disabled={callToActionCount >= 2 || buttons.length >= 10}
            className="flex items-center gap-2 p-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <FiLink className="w-4 h-4" />
            <div className="text-left flex-1">
              <div className="text-sm font-medium">Acessar Site</div>
              <div className="text-xs text-gray-500">{callToActionCount}/2 CTA</div>
            </div>
          </button>

          {category === 'UTILITY' && (
            <button
              onClick={() => handleAddButton('COPY_CODE')}
              disabled={copyCodeCount >= 1 || buttons.length >= 10}
              className="flex items-center gap-2 p-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <FiCopy className="w-4 h-4" />
              <div className="text-left flex-1">
                <div className="text-sm font-medium">Copiar Código</div>
                <div className="text-xs text-gray-500">{copyCodeCount}/1</div>
              </div>
            </button>
          )}
        </div>

        {/* Button List */}
        {buttons.length > 0 && (
          <div className="space-y-3">
            {buttons.map((button, index) => (
              <div
                key={index}
                className="p-4 border border-gray-300 dark:border-gray-600 rounded-xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {button.type === 'QUICK_REPLY' && '💬 Resposta Rápida'}
                    {button.type === 'PHONE_NUMBER' && '📞 Ligar'}
                    {button.type === 'URL' && '🔗 Acessar Site'}
                    {button.type === 'COPY_CODE' && '📋 Copiar Código'}
                  </span>
                  <button
                    onClick={() => handleRemoveButton(index)}
                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                  >
                    <FiX className="w-4 h-4 text-red-600" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                    Texto do Botão
                  </label>
                  <input
                    type="text"
                    value={button.text}
                    onChange={(e) => handleUpdateButton(index, { text: e.target.value })}
                    placeholder="Ex: Confirmar, Ver mais, Copiar"
                    maxLength={25}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                  />
                </div>

                {button.type === 'PHONE_NUMBER' && (
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Número de Telefone
                    </label>
                    <input
                      type="tel"
                      value={button.phone_number || ''}
                      onChange={(e) => handleUpdateButton(index, { phone_number: e.target.value })}
                      placeholder="+55 11 98765-4321"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                )}

                {button.type === 'URL' && (
                  <>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        URL (estática ou com variável)
                      </label>
                      <input
                        type="url"
                        value={button.url || ''}
                        onChange={(e) => handleUpdateButton(index, { url: e.target.value })}
                        placeholder="https://example.com ou https://example.com/{{1}}"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                      />
                    </div>
                    {button.url?.includes('{{1}}') && (
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                          Exemplo de variável da URL
                        </label>
                        <input
                          type="text"
                          value={button.example?.[0] || ''}
                          onChange={(e) => handleUpdateButton(index, { example: [e.target.value] })}
                          placeholder="Ex: promo-2024"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                        />
                      </div>
                    )}
                  </>
                )}

                {button.type === 'COPY_CODE' && (
                  <div>
                    <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                      Código de exemplo
                    </label>
                    <input
                      type="text"
                      value={button.example?.[0] || ''}
                      onChange={(e) => handleUpdateButton(index, { example: [e.target.value] })}
                      placeholder="Ex: PROMO2024"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {buttons.length === 0 && (
          <div className="p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
            <p className="text-sm text-gray-500">
              Nenhum botão adicionado. Clique acima para adicionar botões interativos.
            </p>
          </div>
        )}

        <p className="mt-2 text-xs text-gray-500">
          Máximo: 3 respostas rápidas + 2 call-to-action + 1 copiar código
        </p>
      </div>
    </div>
  );
};

export default MetaButtonsBuilder;
