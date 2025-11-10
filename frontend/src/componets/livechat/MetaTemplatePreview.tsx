import React from 'react';
import { HeaderComponent, BodyComponent, ButtonComponent } from './MetaTemplateTypes';

interface MetaTemplatePreviewProps {
  header?: HeaderComponent;
  body: BodyComponent;
  footer?: string;
  buttons?: ButtonComponent[];
}

export const MetaTemplatePreview: React.FC<MetaTemplatePreviewProps> = ({
  header,
  body,
  footer,
  buttons
}) => {
  // Substitui variáveis por exemplos
  const renderBodyText = () => {
    let text = body.text;
    if (body.examples?.[0]) {
      body.examples[0].forEach((example, i) => {
        text = text.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), example || `{{${i + 1}}}`);
      });
    }
    return text;
  };

  // Converte formatação WhatsApp para HTML
  const formatWhatsAppText = (text: string) => {
    return text
      .replace(/\*([^*]+)\*/g, '<strong>$1</strong>') // *negrito*
      .replace(/_([^_]+)_/g, '<em>$1</em>') // _itálico_
      .replace(/~([^~]+)~/g, '<del>$1</del>') // ~tachado~
      .replace(/```([^`]+)```/g, '<code>$1</code>') // ```código```
      .replace(/\n/g, '<br />'); // quebras de linha
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
        Preview do Template
      </h3>

      {/* WhatsApp-style preview */}
      <div className="bg-[#e5ddd5] dark:bg-gray-800 rounded-lg p-4">
        <div className="bg-white dark:bg-gray-700 rounded-lg shadow-sm overflow-hidden max-w-sm">
          {/* Header */}
          {header && (
            <div className="bg-gray-100 dark:bg-gray-600">
              {header.type === 'TEXT' && header.text && (
                <div className="p-3 font-semibold text-gray-900 dark:text-white text-sm">
                  {header.text}
                </div>
              )}
              {header.type === 'IMAGE' && (
                <div className="aspect-video bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  {header.example?.header_handle?.[0] ? (
                    <img
                      src={header.example.header_handle[0]}
                      alt="Header"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentElement!.innerHTML = `
                          <div class="flex flex-col items-center justify-center h-full text-gray-500">
                            <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span class="text-xs">Imagem</span>
                          </div>
                        `;
                      }}
                    />
                  ) : (
                    <div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
                      <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs">Imagem</span>
                    </div>
                  )}
                </div>
              )}
              {header.type === 'VIDEO' && (
                <div className="aspect-video bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                  <div className="flex flex-col items-center text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs">Vídeo</span>
                  </div>
                </div>
              )}
              {header.type === 'DOCUMENT' && (
                <div className="p-3 flex items-center gap-3 bg-gray-100 dark:bg-gray-600">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                      documento.pdf
                    </div>
                    <div className="text-xs text-gray-500">PDF</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Body */}
          <div className="p-3">
            {body.text ? (
              <div
                className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap wrap-break-word"
                dangerouslySetInnerHTML={{ __html: formatWhatsAppText(renderBodyText()) }}
              />
            ) : (
              <div className="text-sm text-gray-400 italic">
                Digite o corpo da mensagem...
              </div>
            )}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-3 pb-2">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {footer}
              </div>
            </div>
          )}

          {/* Buttons */}
          {buttons && buttons.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-600">
              {buttons.map((button, index) => (
                <button
                  key={index}
                  className="w-full py-2.5 px-3 text-center text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors border-b border-gray-200 dark:border-gray-600 last:border-b-0 flex items-center justify-center gap-2"
                >
                  {button.type === 'PHONE_NUMBER' && '📞'}
                  {button.type === 'URL' && '🔗'}
                  {button.type === 'COPY_CODE' && '📋'}
                  {button.type === 'QUICK_REPLY' && '💬'}
                  {button.text || 'Botão'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Cabeçalho:</span>
          <span className="font-medium">
            {header ? (header.type === 'TEXT' ? 'Texto' : header.type) : 'Nenhum'}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Variáveis no corpo:</span>
          <span className="font-medium">
            {body.examples?.[0]?.length || 0}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Botões:</span>
          <span className="font-medium">
            {buttons?.length || 0}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MetaTemplatePreview;
