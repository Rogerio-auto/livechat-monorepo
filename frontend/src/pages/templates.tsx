import { useEffect, useState } from "react";
import { FaFileUpload, FaTrash, FaEdit, FaDownload, FaCheck, FaTimes, FaInfoCircle } from "react-icons/fa";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

type Template = {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  doc_type: "PROPOSTA" | "CONTRATO" | "RECIBO" | "PROCURACAO" | "OUTRO";
  template_path: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at?: string | null;
};

type Variable = {
  key: string;
  description: string;
  category: string;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadDocType, setUploadDocType] = useState<string>("PROPOSTA");
  const [uploadIsDefault, setUploadIsDefault] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const fetchJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const res = await fetch(url, { credentials: "include", ...init });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `HTTP ${res.status}`);
    }
    return res.json();
  };

  const loadTemplates = async () => {
    try {
      const data = await fetchJson<Template[]>(`${API}/document-templates`);
      setTemplates(data || []);
    } catch (e: any) {
      setError(e?.message || "Erro ao carregar templates");
    }
  };

  const loadVariables = async () => {
    try {
      const data = await fetchJson<Variable[]>(`${API}/document-variables`);
      setVariables(data || []);
    } catch (e: any) {
      console.error("Erro ao carregar variáveis:", e);
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([loadTemplates(), loadVariables()]);
      setLoading(false);
    };
    load();
  }, []);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        setUploadFile(file);
        if (!uploadName) setUploadName(file.name.replace(".docx", ""));
      } else {
        alert("Apenas arquivos .docx são permitidos");
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        setUploadFile(file);
        if (!uploadName) setUploadName(file.name.replace(".docx", ""));
      } else {
        alert("Apenas arquivos .docx são permitidos");
      }
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    if (!uploadName.trim()) {
      alert("Nome do template é obrigatório");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("template", uploadFile);
      formData.append("name", uploadName.trim());
      formData.append("description", uploadDescription.trim());
      formData.append("doc_type", uploadDocType);
      formData.append("is_default", String(uploadIsDefault));

      const res = await fetch(`${API}/document-templates`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Erro ao fazer upload");
      }

      await loadTemplates();
      setShowUpload(false);
      setUploadFile(null);
      setUploadName("");
      setUploadDescription("");
      setUploadDocType("PROPOSTA");
      setUploadIsDefault(false);
    } catch (e: any) {
      alert(e?.message || "Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este template?")) return;

    try {
      await fetchJson(`${API}/document-templates/${id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      alert(e?.message || "Erro ao excluir template");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await fetchJson(`${API}/document-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_active: !currentActive } : t))
      );
    } catch (e: any) {
      alert(e?.message || "Erro ao atualizar template");
    }
  };

  const handleToggleDefault = async (id: string, currentDefault: boolean) => {
    try {
      await fetchJson(`${API}/document-templates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: !currentDefault }),
      });
      await loadTemplates(); // Recarregar para atualizar outros templates do mesmo tipo
    } catch (e: any) {
      alert(e?.message || "Erro ao atualizar template");
    }
  };

  const filteredTemplates = templates.filter((t) =>
    filterType === "ALL" ? true : t.doc_type === filterType
  );

  const docTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      PROPOSTA: "Proposta",
      CONTRATO: "Contrato",
      RECIBO: "Recibo",
      PROCURACAO: "Procuração",
      OUTRO: "Outro",
    };
    return labels[type] || type;
  };

  const docTypeBadge = (type: string) => {
    const colors: Record<string, string> = {
      PROPOSTA: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-200",
      CONTRATO: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-200",
      RECIBO: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200",
      PROCURACAO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200",
      OUTRO: "bg-slate-100 text-slate-700 dark:bg-slate-500/20 dark:text-slate-200",
    };
    return colors[type] || colors.OUTRO;
  };

  const variablesByCategory = variables.reduce((acc, v) => {
    if (!acc[v.category]) acc[v.category] = [];
    acc[v.category].push(v);
    return acc;
  }, {} as Record<string, Variable[]>);

  return (
    <div
      className="ml-16 min-h-screen p-4 sm:p-6 lg:p-8"
      style={{ backgroundColor: "var(--color-bg)", color: "var(--color-text)" }}
    >
      <div
        className="mt-8 rounded-2xl border p-4 sm:p-6 shadow-lg theme-surface"
        style={{
          borderColor: "var(--color-border)",
          boxShadow: "0 32px 48px -32px var(--color-card-shadow)",
        }}
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center mb-6">
          <div>
            <h2 className="text-2xl font-semibold theme-heading">Templates de Documentos</h2>
            <p className="theme-text-muted text-sm mt-1">
              Gerencie templates DOCX para gerar propostas, contratos e recibos
            </p>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <button
              onClick={() => setShowVariables(true)}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
              style={{
                backgroundColor: "var(--color-surface-muted)",
                borderColor: "var(--color-border)",
                border: "1px solid",
              }}
            >
              <FaInfoCircle />
              <span className="text-sm">Variáveis</span>
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex-1 sm:flex-initial theme-primary px-4 py-2 rounded-xl transition flex items-center justify-center gap-2 shadow-sm"
            >
              <FaFileUpload />
              <span>Novo Template</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-2">
          {["ALL", "PROPOSTA", "CONTRATO", "RECIBO", "PROCURACAO", "OUTRO"].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl text-sm transition ${
                filterType === type
                  ? "theme-primary"
                  : "theme-surface-muted border"
              }`}
              style={
                filterType !== type
                  ? { borderColor: "var(--color-border)" }
                  : undefined
              }
            >
              {type === "ALL" ? "Todos" : docTypeLabel(type)}
            </button>
          ))}
        </div>

        {/* Loading/Error */}
        {loading && <div className="theme-text-muted">Carregando...</div>}
        {error && !loading && <div className="text-red-500">{error}</div>}

        {/* Templates Grid */}
        {!loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                className="rounded-2xl border p-4 theme-surface-muted relative"
                style={{ borderColor: "var(--color-border)" }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${docTypeBadge(template.doc_type)}`}
                  >
                    {docTypeLabel(template.doc_type)}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggleActive(template.id, template.is_active)}
                      className={`p-1.5 rounded-lg text-xs transition ${
                        template.is_active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                      title={template.is_active ? "Ativo" : "Inativo"}
                    >
                      {template.is_active ? <FaCheck size={10} /> : <FaTimes size={10} />}
                    </button>
                    <button
                      onClick={() => handleDelete(template.id)}
                      className="p-1.5 rounded-lg text-xs bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200 hover:bg-rose-200 dark:hover:bg-rose-500/30 transition"
                      title="Excluir"
                    >
                      <FaTrash size={10} />
                    </button>
                  </div>
                </div>

                {/* Content */}
                <h3 className="font-semibold theme-heading text-sm mb-1 line-clamp-2">
                  {template.name}
                </h3>
                {template.description && (
                  <p className="text-xs theme-text-muted line-clamp-2 mb-3">
                    {template.description}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
                  <button
                    onClick={() => handleToggleDefault(template.id, template.is_default)}
                    className={`text-xs px-2 py-1 rounded-md transition ${
                      template.is_default
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-200"
                        : "theme-text-muted hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    {template.is_default ? "★ Padrão" : "☆ Definir padrão"}
                  </button>
                  <span className="text-xs theme-text-muted">
                    {new Date(template.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>
            ))}

            {filteredTemplates.length === 0 && (
              <div className="col-span-full text-center py-12 theme-text-muted">
                <FaFileUpload size={48} className="mx-auto mb-4 opacity-30" />
                <p>Nenhum template encontrado</p>
                <p className="text-sm mt-2">Clique em "Novo Template" para começar</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Upload */}
      {showUpload && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: "var(--color-overlay)" }}
        >
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-xl theme-surface"
            style={{
              borderColor: "var(--color-border)",
              boxShadow: "0 40px 64px -40px var(--color-card-shadow)",
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold theme-heading">Upload de Template</h3>
              <button
                className="theme-text-muted hover:opacity-70 transition text-2xl"
                onClick={() => setShowUpload(false)}
              >
                ×
              </button>
            </div>

            {/* Drag & Drop Area */}
            <div
              className={`border-2 border-dashed rounded-2xl p-8 mb-4 text-center transition ${
                dragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-slate-300 dark:border-slate-700"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {uploadFile ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FaFileUpload size={32} className="text-blue-500" />
                    <div className="text-left">
                      <p className="font-medium theme-heading">{uploadFile.name}</p>
                      <p className="text-xs theme-text-muted">
                        {(uploadFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setUploadFile(null)}
                    className="text-rose-500 hover:text-rose-700"
                  >
                    <FaTrash />
                  </button>
                </div>
              ) : (
                <>
                  <FaFileUpload size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="theme-heading mb-2">Arraste um arquivo DOCX aqui</p>
                  <p className="text-sm theme-text-muted mb-4">ou</p>
                  <label className="theme-primary px-6 py-2 rounded-xl cursor-pointer inline-block">
                    Escolher Arquivo
                    <input
                      type="file"
                      accept=".docx"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                </>
              )}
            </div>

            {/* Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 theme-heading">
                  Nome do Template *
                </label>
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder="Ex: Proposta Solar Premium"
                  className="config-input w-full rounded-xl px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 theme-heading">
                  Descrição
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Descreva o template..."
                  rows={3}
                  className="config-input w-full rounded-xl px-4 py-2"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 theme-heading">
                  Tipo de Documento *
                </label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="config-input w-full rounded-xl px-4 py-2"
                >
                  <option value="PROPOSTA">Proposta</option>
                  <option value="CONTRATO">Contrato</option>
                  <option value="RECIBO">Recibo</option>
                  <option value="PROCURACAO">Procuração</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={uploadIsDefault}
                  onChange={(e) => setUploadIsDefault(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="is_default" className="text-sm theme-heading">
                  Definir como template padrão para este tipo
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6 pt-4 border-t" style={{ borderColor: "var(--color-border)" }}>
              <button
                onClick={() => setShowUpload(false)}
                className="flex-1 px-4 py-2 rounded-xl border theme-surface-muted"
                style={{ borderColor: "var(--color-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadFile || !uploadName.trim() || uploading}
                className="flex-1 theme-primary px-4 py-2 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? "Enviando..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Variáveis */}
      {showVariables && (
        <div
          className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          style={{ backgroundColor: "var(--color-overlay)" }}
        >
          <div
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border p-6 shadow-xl theme-surface"
            style={{
              borderColor: "var(--color-border)",
              boxShadow: "0 40px 64px -40px var(--color-card-shadow)",
            }}
          >
            <div className="flex items-center justify-between mb-4 sticky top-0 theme-surface pb-4">
              <div>
                <h3 className="text-xl font-semibold theme-heading">Variáveis Disponíveis</h3>
                <p className="text-sm theme-text-muted mt-1">
                  Use essas variáveis nos seus templates DOCX no formato <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">#VARIAVEL</code>
                </p>
              </div>
              <button
                className="theme-text-muted hover:opacity-70 transition text-2xl"
                onClick={() => setShowVariables(false)}
              >
                ×
              </button>
            </div>

            {Object.entries(variablesByCategory).map(([category, vars]) => (
              <div key={category} className="mb-6">
                <h4 className="font-semibold theme-heading mb-3 text-lg">{category}</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {vars.map((v) => (
                    <div
                      key={v.key}
                      className="rounded-xl border p-3 theme-surface-muted"
                      style={{ borderColor: "var(--color-border)" }}
                    >
                      <code className="text-sm font-mono text-blue-600 dark:text-blue-400">
                        #{v.key}
                      </code>
                      <p className="text-xs theme-text-muted mt-1">{v.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
