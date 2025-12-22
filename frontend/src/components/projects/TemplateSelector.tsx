// frontend/src/components/projects/TemplateSelector.tsx

import { useState, useEffect } from "react";
import { fetchJson } from "../../lib/fetch";
import type { TemplateWithDetails } from "../../types/projects";
import { Layout, ChevronRight, Search, Star } from "lucide-react";

const API = import.meta.env.VITE_API_URL;

type Props = {
  onSelect: (template: TemplateWithDetails) => void;
};

export default function TemplateSelector({ onSelect }: Props) {
  const [templates, setTemplates] = useState<TemplateWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await fetchJson(`${API}/project-templates`);
      setTemplates(data);
    } catch (err) {
      console.error('Erro ao carregar templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.description?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Carregando templates...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Como deseja começar?
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Selecione um modelo otimizado para o seu nicho ou comece do zero.
        </p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <input
          type="text"
          placeholder="Buscar modelos (ex: Solar, Imobiliária, Advocacia...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTemplates.map((template) => (
          <button
            key={template.id}
            onClick={() => onSelect(template)}
            className="group flex items-start gap-4 p-5 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-xl transition-all text-left"
          >
            <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-2xl group-hover:scale-110 transition-transform">
              {template.icon || '📋'}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {template.name}
                </h3>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {template.description || 'Modelo padrão para gestão de projetos.'}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                  {template.stages.length} Etapas
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                  {template.custom_fields.length} Campos
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Nenhum modelo encontrado para "{search}"</p>
        </div>
      )}
    </div>
  );
}

