import React, { useState } from 'react';
import { FiType, FiImage, FiVideo, FiFile, FiFolder, FiX } from 'react-icons/fi';
import { HeaderComponent } from './MetaTemplateTypes';

interface MetaHeaderBuilderProps {
  header: HeaderComponent | undefined;
  onChange: (header: HeaderComponent | undefined) => void;
  onOpenMediaLibrary?: (type: 'IMAGE' | 'VIDEO' | 'DOCUMENT') => void;
}

export const MetaHeaderBuilder: React.FC<MetaHeaderBuilderProps> = ({ header, onChange, onOpenMediaLibrary }) => {
  const [hasHeader, setHasHeader] = useState(!!header);

  const handleToggleHeader = (enabled: boolean) => {
    setHasHeader(enabled);
    if (!enabled) {
      onChange(undefined);
    } else {
      onChange({ type: 'TEXT', text: '' });
    }
  };

  const handleTypeChange = (type: HeaderComponent['type']) => {
    if (type === 'TEXT') {
      onChange({ type: 'TEXT', text: '' });
    } else {
      onChange({ 
        type, 
        example: { header_handle: [''] } 
      });
    }
  };

  const handleTextChange = (text: string) => {
    if (header?.type === 'TEXT') {
      onChange({ ...header, text });
    }
  };

  const handleRemoveMedia = () => {
    if (header && header.type !== 'TEXT') {
      onChange({
        ...header,
        example: { header_handle: [''] }
      });
    }
  };

  const renderMediaPreview = () => {
    if (!header || header.type === 'TEXT') return null;
    const url = header.example?.header_handle?.[0];
    if (!url) return null;

    if (header.type === 'IMAGE') {
      return (
        <div className="relative inline-block">
          <img 
            src={url} 
            alt="Preview" 
            className="w-20 h-20 object-cover rounded-lg border-2 border-gray-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <button
            onClick={handleRemoveMedia}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      );
    }

    if (header.type === 'VIDEO') {
      return (
        <div className="relative inline-block">
          <video 
            src={url} 
            className="w-32 h-20 object-cover rounded-lg border-2 border-gray-300"
          />
          <button
            onClick={handleRemoveMedia}
            className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
          >
            <FiX className="w-4 h-4" />
          </button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <FiFile className="w-5 h-5 text-gray-600" />
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate flex-1">
          {url.split('/').pop() || 'Documento'}
        </span>
        <button
          onClick={handleRemoveMedia}
          className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shrink-0"
        >
          <FiX className="w-4 h-4" />
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={hasHeader}
            onChange={(e) => handleToggleHeader(e.target.checked)}
            className="w-4 h-4 text-blue-600 rounded"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Adicionar cabeçalho
          </span>
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Cabeçalho opcional para destacar sua mensagem
        </p>
      </div>

      {hasHeader && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Tipo de Cabeçalho
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'TEXT', icon: FiType, label: 'Texto', desc: 'Texto simples' },
                { type: 'IMAGE', icon: FiImage, label: 'Imagem', desc: 'JPG, PNG' },
                { type: 'VIDEO', icon: FiVideo, label: 'Vídeo', desc: 'MP4' },
                { type: 'DOCUMENT', icon: FiFile, label: 'Documento', desc: 'PDF' }
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    onClick={() => handleTypeChange(item.type as HeaderComponent['type'])}
                    className={`p-4 rounded-xl border-2 transition-all flex items-start gap-3 ${
                      header?.type === item.type
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
                    }`}
                  >
                    <Icon className="w-5 h-5 mt-0.5" />
                    <div className="text-left">
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{item.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {header?.type === 'TEXT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Texto do Cabeçalho
              </label>
              <input
                type="text"
                value={header.text || ''}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Ex: Oferta Especial 🎉"
                maxLength={60}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-gray-500">Máximo 60 caracteres</p>
            </div>
          )}

          {header && header.type !== 'TEXT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {header.type === 'IMAGE' && 'Imagem do Cabeçalho'}
                {header.type === 'VIDEO' && 'Vídeo do Cabeçalho'}
                {header.type === 'DOCUMENT' && 'Documento do Cabeçalho'}
              </label>

              {header.example?.header_handle?.[0] ? (
                <div className="space-y-3">
                  {renderMediaPreview()}
                  <button
                    type="button"
                    onClick={() => onOpenMediaLibrary?.(header.type as any)}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                  >
                    Trocar mídia
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onOpenMediaLibrary?.(header.type as any)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl hover:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
                >
                  <FiFolder className="w-5 h-5" />
                  <span className="text-sm font-medium">Selecionar da Galeria</span>
                </button>
              )}

              <p className="mt-2 text-xs text-gray-500">
                {header.type === 'IMAGE' && 'PNG ou JPG. Máximo 5MB.'}
                {header.type === 'VIDEO' && 'MP4. Máximo 16MB.'}
                {header.type === 'DOCUMENT' && 'PDF. Máximo 100MB.'}
              </p>
            </div>
          )}
        </>
      )}

      {!hasHeader && (
        <div className="p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl">
          <p className="text-sm text-gray-500">
            Nenhum cabeçalho será adicionado ao template
          </p>
        </div>
      )}
    </div>
  );
};

export default MetaHeaderBuilder;
