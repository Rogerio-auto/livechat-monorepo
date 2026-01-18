// frontend/src/pages/Admin/Templates/TemplateList.tsx

import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiPlay, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { showToast } from '../../../hooks/useToast';

interface Template {
  id: string;
  name: string;
  category: string;
  version: number;
  is_active: boolean;
  is_public: boolean;
  usage_count: number;
  rating: number;
  created_at: string;
}

export default function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/admin/templates', {
        params: { search }
      } as any);
      setTemplates(response.data.templates);
    } catch (error) {
      showToast('Erro ao carregar templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este template?')) return;
    try {
      await api.delete(`/api/admin/templates/${id}`);
      showToast('Template excluído', 'success');
      fetchTemplates();
    } catch (error) {
      showToast('Erro ao excluir template', 'error');
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Templates de Agentes</h1>
          <p className="text-slate-400">Gerencie os modelos base para criação de novos agentes.</p>
        </div>
        <button
          onClick={() => navigate('/admin/templates/new')}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition"
        >
          <FiPlus /> Novo Template
        </button>
      </div>

      <div className="bg-slate-900/50 border border-white/10 rounded-xl p-4 flex gap-4">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar por nome ou categoria..."
            className="w-full bg-slate-950 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchTemplates()}
          />
        </div>
        <button
          onClick={fetchTemplates}
          className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition"
        >
          Filtrar
        </button>
      </div>

      <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="px-6 py-4 text-sm font-medium text-slate-300">Nome</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-300">Categoria</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-300">Versão</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-300">Status</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-300">Uso</th>
              <th className="px-6 py-4 text-sm font-medium text-slate-300 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500">Carregando...</td>
              </tr>
            ) : templates.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-500">Nenhum template encontrado.</td>
              </tr>
            ) : (
              templates.map((template) => (
                <tr key={template.id} className="hover:bg-white/5 transition">
                  <td className="px-6 py-4">
                    <div className="font-medium text-white">{template.name}</div>
                    <div className="text-xs text-slate-500">{template.id}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded text-xs border border-indigo-500/20">
                      {template.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-300">v{template.version}</td>
                  <td className="px-6 py-4">
                    {template.is_active ? (
                      <span className="flex items-center gap-1 text-emerald-400 text-xs">
                        <FiCheckCircle /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-slate-500 text-xs">
                        <FiAlertCircle /> Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-300">{template.usage_count}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => navigate(`/admin/templates/${template.id}/test`)}
                        className="p-2 text-amber-400 hover:bg-amber-400/10 rounded-lg transition"
                        title="Testar"
                      >
                        <FiPlay size={18} />
                      </button>
                      <button
                        onClick={() => navigate(`/admin/templates/${template.id}`)}
                        className="p-2 text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition"
                        title="Editar"
                      >
                        <FiEdit2 size={18} />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 text-rose-400 hover:bg-rose-400/10 rounded-lg transition"
                        title="Excluir"
                      >
                        <FiTrash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
