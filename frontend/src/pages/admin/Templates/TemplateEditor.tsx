// frontend/src/pages/Admin/Templates/TemplateEditor.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiSave, FiArrowLeft, FiPlus, FiTrash2, FiSettings, FiCpu, FiTool, FiHelpCircle, FiList } from 'react-icons/fi';
import { api } from '@/lib/api';
import { showToast } from '../../../hooks/useToast';

export default function TemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [template, setTemplate] = useState<any>({
    name: '',
    description: '',
    category: 'general',
    system_prompt: '',
    model_config: {
      provider: 'openai',
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 2000
    },
    behavior_config: {
      response_style: 'helpful',
      language: 'pt-BR'
    },
    is_active: true,
    is_public: true
  });

  const [availableTools, setAvailableTools] = useState<any[]>([]);
  const [selectedTools, setSelectedTools] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchTools();
    if (id && id !== 'new') {
      fetchTemplate();
    }
  }, [id]);

  const fetchTools = async () => {
    try {
      const response = await api.get('/api/tools'); 
      setAvailableTools(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Erro ao carregar catálogo de ferramentas');
    }
  };

  const fetchTemplate = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/admin/templates/${id}`);
      setTemplate(response.data);
      setSelectedTools(response.data.tools || []);
      setQuestions(response.data.questions || []);
      
      // Inicializar preview answers
      const initialAnswers: Record<string, string> = {};
      (response.data.questions || []).forEach((q: any) => {
        initialAnswers[q.key] = '';
      });
      setPreviewAnswers(initialAnswers);
    } catch (error) {
      showToast('Erro ao carregar template', 'error');
      navigate('/admin/templates');
    } finally {
      setLoading(false);
    }
  };

  const renderPreviewPrompt = () => {
    let prompt = template.system_prompt || '';
    Object.entries(previewAnswers).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      prompt = prompt.replace(regex, value || `[${key}]`);
    });
    return prompt;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      let savedTemplate;
      
      if (isNew) {
        const response = await api.post('/api/admin/templates', template);
        savedTemplate = response.data;
      } else {
        const response = await api.put(`/api/admin/templates/${id}`, template);
        savedTemplate = response.data;
      }

      // Salvar ferramentas
      await api.put(`/api/admin/templates/${savedTemplate.id}/tools`, {
        tools: selectedTools.map(t => ({
          tool_id: t.tool_id || t.id,
          required: t.required || false,
          overrides: t.overrides || {}
        }))
      });

      // Salvar perguntas
      await api.put(`/api/admin/templates/${savedTemplate.id}/questions`, {
        questions: questions.map((q, idx) => ({
          ...q,
          order_index: idx
        }))
      });

      showToast('Template salvo com sucesso!', 'success');
      if (isNew) navigate(`/admin/templates/${savedTemplate.id}`);
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Erro ao salvar template', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleTool = (tool: any) => {
    const exists = selectedTools.find(t => (t.tool_id || t.id) === tool.id);
    if (exists) {
      setSelectedTools(selectedTools.filter(t => (t.tool_id || t.id) !== tool.id));
    } else {
      setSelectedTools([...selectedTools, { ...tool, tool_id: tool.id, required: false, overrides: {} }]);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, {
      key: '',
      label: '',
      type: 'text',
      required: true,
      help: '',
      options: []
    }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, updates: any) => {
    const newQuestions = [...questions];
    newQuestions[index] = { ...newQuestions[index], ...updates };
    setQuestions(newQuestions);
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Carregando...</div>;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/templates')}
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 transition"
          >
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {isNew ? 'Novo Template' : `Editar: ${template.name}`}
            </h1>
            <p className="text-slate-400">Configure o comportamento e capacidades do agente.</p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg transition shadow-lg shadow-indigo-500/20"
        >
          <FiSave /> {saving ? 'Salvando...' : 'Salvar Template'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Principal: Prompt e Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiSettings className="text-indigo-400" /> Informações Básicas
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm text-slate-400">Nome do Template</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={template.name}
                  onChange={e => setTemplate({ ...template, name: e.target.value })}
                  placeholder="Ex: Assistente de Vendas Imobiliárias"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm text-slate-400">Categoria</label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={template.category}
                  onChange={e => setTemplate({ ...template, category: e.target.value })}
                >
                  <option value="general">Geral</option>
                  <option value="sales">Vendas</option>
                  <option value="support">Suporte</option>
                  <option value="education">Educação</option>
                  <option value="health">Saúde</option>
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Descrição</label>
              <textarea
                className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none h-20"
                value={template.description}
                onChange={e => setTemplate({ ...template, description: e.target.value })}
                placeholder="Descreva o propósito deste template..."
              />
            </div>
          </div>

          {/* Perguntas do Wizard */}
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FiHelpCircle className="text-indigo-400" /> Perguntas do Wizard
              </h2>
              <button
                onClick={addQuestion}
                className="flex items-center gap-1 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-lg transition border border-indigo-500/20"
              >
                <FiPlus /> Adicionar Pergunta
              </button>
            </div>
            <p className="text-xs text-slate-500">Estas perguntas serão feitas ao usuário para personalizar o prompt. Use {'{{key}}'} no System Prompt.</p>
            
            <div className="space-y-4">
              {questions.map((q, idx) => (
                <div key={idx} className="bg-slate-950 border border-white/5 rounded-xl p-4 space-y-3 relative group">
                  <button
                    onClick={() => removeQuestion(idx)}
                    className="absolute top-4 right-4 text-slate-600 hover:text-rose-500 transition opacity-0 group-hover:opacity-100"
                  >
                    <FiTrash2 size={16} />
                  </button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Chave (ID)</label>
                      <input
                        type="text"
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-indigo-500"
                        value={q.key}
                        onChange={e => updateQuestion(idx, { key: e.target.value })}
                        placeholder="ex: nome_empresa"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Rótulo (Label)</label>
                      <input
                        type="text"
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-indigo-500"
                        value={q.label}
                        onChange={e => updateQuestion(idx, { label: e.target.value })}
                        placeholder="ex: Qual o nome da sua empresa?"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Tipo</label>
                      <select
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-indigo-500"
                        value={q.type}
                        onChange={e => updateQuestion(idx, { type: e.target.value })}
                      >
                        <option value="text">Texto Curto</option>
                        <option value="textarea">Texto Longo</option>
                        <option value="select">Seleção Única</option>
                        <option value="multiselect">Múltipla Escolha</option>
                        <option value="boolean">Sim/Não</option>
                        <option value="number">Número</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Obrigatória</label>
                      <div className="flex items-center h-9">
                        <input
                          type="checkbox"
                          className="w-4 h-4 rounded border-white/10 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                          checked={q.required}
                          onChange={e => updateQuestion(idx, { required: e.target.checked })}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 uppercase font-bold">Ajuda (Help)</label>
                      <input
                        type="text"
                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-indigo-500"
                        value={q.help}
                        onChange={e => updateQuestion(idx, { help: e.target.value })}
                        placeholder="Dica para o usuário..."
                      />
                    </div>
                  </div>
                </div>
              ))}
              {questions.length === 0 && (
                <div className="text-center py-8 border-2 border-dashed border-white/5 rounded-xl text-slate-600 text-sm">
                  Nenhuma pergunta configurada para este template.
                </div>
              )}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiCpu className="text-indigo-400" /> System Prompt
            </h2>
            <p className="text-xs text-slate-500">Este é o "cérebro" do agente. Defina sua personalidade, regras e objetivos.</p>
            <textarea
              className="w-full bg-slate-950 border border-white/10 rounded-lg px-4 py-4 text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-96"
              value={template.system_prompt}
              onChange={e => setTemplate({ ...template, system_prompt: e.target.value })}
              placeholder="Você é um assistente especializado em..."
            />
          </div>

          {/* Preview do Prompt Renderizado */}
          {questions.length > 0 && (
            <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <FiCpu className="text-emerald-400" /> Preview do Prompt Renderizado
              </h2>
              <p className="text-xs text-slate-500">Veja como o prompt ficará após o usuário responder ao wizard.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase">Respostas de Teste</h3>
                  <div className="space-y-3">
                    {questions.map((q, idx) => (
                      <div key={idx} className="space-y-1">
                        <label className="text-[10px] text-slate-500 uppercase">{q.label || q.key}</label>
                        <input
                          type="text"
                          className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm outline-none focus:border-emerald-500"
                          value={previewAnswers[q.key] || ''}
                          onChange={e => setPreviewAnswers({ ...previewAnswers, [q.key]: e.target.value })}
                          placeholder={`Valor para {{${q.key}}}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-slate-500 uppercase">Resultado</h3>
                  <div className="bg-slate-950 border border-white/10 rounded-lg p-4 text-slate-300 text-xs font-mono h-[300px] overflow-y-auto whitespace-pre-wrap">
                    {renderPreviewPrompt()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Coluna Lateral: Configurações e Ferramentas */}
        <div className="space-y-6">
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiSettings className="text-indigo-400" /> Modelo LLM
            </h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase">Provedor</label>
                <select
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  value={template.model_config.provider}
                  onChange={e => setTemplate({
                    ...template,
                    model_config: { ...template.model_config, provider: e.target.value }
                  })}
                >
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="groq">Groq</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500 uppercase">Modelo</label>
                <input
                  type="text"
                  className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                  value={template.model_config.model}
                  onChange={e => setTemplate({
                    ...template,
                    model_config: { ...template.model_config, model: e.target.value }
                  })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 uppercase">Temp ({template.model_config.temperature})</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    className="w-full"
                    value={template.model_config.temperature}
                    onChange={e => setTemplate({
                      ...template,
                      model_config: { ...template.model_config, temperature: parseFloat(e.target.value) }
                    })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-slate-500 uppercase">Max Tokens</label>
                  <input
                    type="number"
                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none"
                    value={template.model_config.max_tokens}
                    onChange={e => setTemplate({
                      ...template,
                      model_config: { ...template.model_config, max_tokens: parseInt(e.target.value) }
                    })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <FiTool className="text-indigo-400" /> Ferramentas Habilitadas
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {availableTools.map(tool => {
                const isSelected = selectedTools.find(t => (t.tool_id || t.id) === tool.id);
                return (
                  <div
                    key={tool.id}
                    onClick={() => toggleTool(tool)}
                    className={`p-3 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                      isSelected 
                        ? 'bg-indigo-500/10 border-indigo-500/50 text-white' 
                        : 'bg-slate-950 border-white/5 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-indigo-400' : 'bg-slate-700'}`} />
                      <span className="text-sm font-medium">{tool.name}</span>
                    </div>
                    {isSelected && <span className="text-[10px] bg-indigo-500 text-white px-1.5 py-0.5 rounded uppercase font-bold">Ativa</span>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-semibold text-white">Visibilidade</h2>
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-white/5">
              <span className="text-sm text-slate-300">Template Público</span>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-white/10 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                checked={template.is_public}
                onChange={e => setTemplate({ ...template, is_public: e.target.checked })}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-slate-950 rounded-lg border border-white/5">
              <span className="text-sm text-slate-300">Ativo</span>
              <input
                type="checkbox"
                className="w-5 h-5 rounded border-white/10 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                checked={template.is_active}
                onChange={e => setTemplate({ ...template, is_active: e.target.checked })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
