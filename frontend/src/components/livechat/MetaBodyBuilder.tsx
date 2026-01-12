import React, { useState } from 'react';
import { FiPlus, FiX, FiAlertCircle } from 'react-icons/fi';
import { BodyComponent } from './MetaTemplateTypes';

interface MetaBodyBuilderProps {
  body: BodyComponent;
  onChange: (body: BodyComponent) => void;
}

export const MetaBodyBuilder: React.FC<MetaBodyBuilderProps> = ({ body, onChange }) => {
  const [variableValues, setVariableValues] = useState<string[]>(['']);

  // Detecta variáveis no formato {{1}}, {{2}}, etc
  const detectVariables = (text: string): number => {
    const matches = text.match(/\{\{(\d+)\}\}/g);
    if (!matches) return 0;
    const numbers = matches.map(m => parseInt(m.replace(/\D/g, '')));
    return Math.max(...numbers, 0);
  };

  const handleTextChange = (text: string) => {
    const varCount = detectVariables(text);
    
    // Atualiza exemplos de variáveis
    const examples = varCount > 0 ? [variableValues.slice(0, varCount)] : undefined;
    
    onChange({
      text,
      examples
    });
  };

  const handleVariableExampleChange = (index: number, value: string) => {
    const newValues = [...variableValues];
    newValues[index] = value;
    setVariableValues(newValues);

    if (body.examples) {
      onChange({
        ...body,
        examples: [newValues.slice(0, body.examples[0].length)]
      });
    }
  };

  const insertVariable = () => {
    const varCount = detectVariables(body.text);
    const newVarNum = varCount + 1;
    const newText = body.text + `{{${newVarNum}}}`;
    
    const newValues = [...variableValues, ''];
    setVariableValues(newValues);
    
    onChange({
      text: newText,
      examples: [newValues.slice(0, newVarNum)]
    });
  };

  const insertFormatting = (tag: string) => {
    const textarea = document.querySelector('textarea[name="body-text"]') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.text.substring(start, end);
    
    let newText = body.text;
    if (selectedText) {
      newText = body.text.substring(0, start) + tag + selectedText + tag + body.text.substring(end);
    } else {
      newText = body.text.substring(0, start) + tag + tag + body.text.substring(end);
    }
    
    handleTextChange(newText);
  };

  const varCount = detectVariables(body.text);
  const charCount = body.text.length;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Corpo da Mensagem *
          </label>
          <span className="text-xs text-gray-500">
            {charCount}/1024 caracteres
          </span>
        </div>

        {/* Formatting Toolbar */}
        <div className="flex items-center gap-2 mb-2 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <button
            onClick={() => insertFormatting('*')}
            className="px-3 py-1 text-sm font-bold hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Negrito"
          >
            B
          </button>
          <button
            onClick={() => insertFormatting('_')}
            className="px-3 py-1 text-sm italic hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Itálico"
          >
            I
          </button>
          <button
            onClick={() => insertFormatting('~')}
            className="px-3 py-1 text-sm line-through hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Tachado"
          >
            S
          </button>
          <button
            onClick={() => insertFormatting('```')}
            className="px-3 py-1 text-sm font-mono hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
            title="Monoespaçado"
          >
            {`</>`}
          </button>
          <div className="flex-1" />
          <button
            onClick={insertVariable}
            className="flex items-center gap-1.5 px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
            title="Inserir variável"
          >
            <FiPlus className="w-3 h-3" />
            Variável
          </button>
        </div>

        <textarea
          name="body-text"
          value={body.text}
          onChange={(e) => handleTextChange(e.target.value)}
          placeholder="Digite o conteúdo da mensagem aqui...&#10;&#10;Use *negrito*, _itálico_, ~tachado~&#10;Adicione variáveis com {{1}}, {{2}}, etc."
          rows={10}
          maxLength={1024}
          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono text-sm resize-none"
        />

        <div className="mt-2 flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <FiAlertCircle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Formatação WhatsApp:</strong>
            <ul className="mt-1 ml-4 list-disc">
              <li>*texto* para negrito</li>
              <li>_texto_ para itálico</li>
              <li>~texto~ para tachado</li>
              <li>```texto``` para monoespaçado</li>
              <li>{'{{1}}, {{2}}'} para variáveis dinâmicas</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Variable Examples */}
      {varCount > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Exemplos de Variáveis
          </label>
          <div className="space-y-3">
            {Array.from({ length: varCount }, (_, i) => (
              <div key={i}>
                <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                  {'{{' + (i + 1) + '}}'}
                </label>
                <input
                  type="text"
                  value={variableValues[i] || ''}
                  onChange={(e) => handleVariableExampleChange(i, e.target.value)}
                  placeholder={`Exemplo para variável ${i + 1}`}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Esses exemplos são necessários para enviar o template para aprovação na Meta
          </p>
        </div>
      )}
    </div>
  );
};

export default MetaBodyBuilder;
