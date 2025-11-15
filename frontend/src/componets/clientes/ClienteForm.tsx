import { useEffect, useState } from "react";
import {
  formatCPF, unformatCPF,
  formatCEP, unformatCEP,
  formatPhoneBR, unformatPhoneBR,
  toISODate, normUF, normNumero
} from "../../utils/format";

type ClienteFormProps = {
  initialData?: any;
  onSubmit: (data: any) => void;
};

const DEFAULTS = {
  tipoPessoa: "Física",
  cpf: "", 
  nome: "", 
  rg: "", 
  orgao: "",
  dataNascimento: "",
  mae: "", 
  pai: "", 
  sexo: "", 
  naturalidade: "",
  estadoCivil: "", 
  conjuge: "",
  cep: "", 
  rua: "", 
  numero: "", 
  complemento: "", 
  bairro: "", 
  uf: "", 
  cidade: "",
  celular: "", 
  celularAlternativo: "", 
  telefone: "", 
  telefoneAlternativo: "",
  email: "", 
  site: "", 
  observacoes: "",
  status: "ativo",
  kanban_column_id: "",
};

export function ClienteForm({ initialData, onSubmit }: ClienteFormProps) {
  const [form, setForm] = useState<any>({ ...DEFAULTS });
  const [columns, setColumns] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);

  // Atualiza form quando initialData mudar
  useEffect(() => {
    if (initialData) {
      setForm({
        ...DEFAULTS,
        ...initialData,
        cpf: initialData.cpf ? formatCPF(initialData.cpf) : "",
        cep: initialData.cep ? formatCEP(initialData.cep) : "",
        celular: initialData.celular ? formatPhoneBR(initialData.celular) : "",
        celularAlternativo: initialData.celularAlternativo ? formatPhoneBR(initialData.celularAlternativo) : "",
        telefone: initialData.telefone ? formatPhoneBR(initialData.telefone) : "",
        telefoneAlternativo: initialData.telefoneAlternativo ? formatPhoneBR(initialData.telefoneAlternativo) : "",
        status: (initialData.status || "ativo").toLowerCase(),
      });
    } else {
      setForm({ ...DEFAULTS });
    }
  }, [initialData]);

  // Carrega colunas do kanban
  useEffect(() => {
    (async () => {
      try {
        const API = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
        const resBoard = await fetch(`${API}/kanban/my-board`, { credentials: 'include' });
        const board = await resBoard.json().catch(() => null);
        if (board?.id) {
          const resCols = await fetch(`${API}/kanban/boards/${board.id}/columns`, { credentials: 'include' });
          const cols = await resCols.json().catch(() => []);
          setColumns((cols || []).map((c: any) => ({ id: c.id, name: c.name ?? c.title })));
        }
      } catch (err) {
        console.error("Failed to load kanban columns:", err);
      }
    })();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;

    const formatMap: Record<string, (v: string) => string> = {
      cpf: formatCPF,
      cep: formatCEP,
      celular: formatPhoneBR,
      celularAlternativo: formatPhoneBR,
      telefone: formatPhoneBR,
      telefoneAlternativo: formatPhoneBR,
      uf: (v: string) => normUF(v),
      numero: (v: string) => normNumero(v),
    };

    const fmt = formatMap[name];
    const next = fmt ? fmt(value) : value;

    setForm((prev: any) => ({ ...prev, [name]: next }));
  };

  const sanitize = (d: any) => {
    const payload: any = {
      nome: d.nome?.trim() || "",
      cpf: unformatCPF(d.cpf),
      email: d.email?.trim() || "",
      status: d.status || "ativo",
      kanban_column_id: d.kanban_column_id || null,
      tipoPessoa: d.tipoPessoa || null,
    };

    // Campos opcionais - só adiciona se tiver valor
    if (d.rg) payload.rg = d.rg.trim();
    if (d.orgao) payload.orgao = d.orgao.trim();
    if (d.dataNascimento) payload.dataNascimento = toISODate(d.dataNascimento);
    if (d.mae) payload.mae = d.mae.trim();
    if (d.pai) payload.pai = d.pai.trim();
    if (d.sexo) payload.sexo = d.sexo.trim();
    if (d.naturalidade) payload.naturalidade = d.naturalidade.trim();
    if (d.estadoCivil) payload.estadoCivil = d.estadoCivil.trim();
    if (d.conjuge) payload.conjuge = d.conjuge.trim();
    if (d.cep) payload.cep = unformatCEP(d.cep);
    if (d.rua) payload.rua = d.rua.trim();
    if (d.numero) payload.numero = normNumero(d.numero);
    if (d.complemento) payload.complemento = d.complemento.trim();
    if (d.bairro) payload.bairro = d.bairro.trim();
    if (d.uf) payload.uf = normUF(d.uf);
    if (d.cidade) payload.cidade = d.cidade.trim();
    if (d.celular) payload.celular = unformatPhoneBR(d.celular);
    if (d.celularAlternativo) payload.celularAlternativo = unformatPhoneBR(d.celularAlternativo);
    if (d.telefone) payload.telefone = unformatPhoneBR(d.telefone);
    if (d.telefoneAlternativo) payload.telefoneAlternativo = unformatPhoneBR(d.telefoneAlternativo);
    if (d.site) payload.site = d.site.trim();
    if (d.observacoes) payload.observacoes = d.observacoes.trim();

    return payload;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.nome?.trim()) {
      alert("Nome é obrigatório");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(sanitize(form));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all";
  const labelClass = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5";

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Seção: Informações Básicas */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Informações Básicas
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome Completo *</label>
            <input
              name="nome"
              value={form.nome || ""}
              onChange={handleChange}
              placeholder="Digite o nome completo"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>CPF</label>
            <input
              name="cpf"
              inputMode="numeric"
              value={form.cpf || ""}
              onChange={handleChange}
              placeholder="000.000.000-00"
              className={inputClass}
              maxLength={14}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>RG</label>
            <input
              name="rg"
              value={form.rg || ""}
              onChange={handleChange}
              placeholder="Digite o RG"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Órgão Emissor</label>
            <input
              name="orgao"
              value={form.orgao || ""}
              onChange={handleChange}
              placeholder="Ex: SSP/SP"
              className={inputClass}
              maxLength={50}
            />
          </div>

          <div>
            <label className={labelClass}>Data de Nascimento</label>
            <input
              type="date"
              name="dataNascimento"
              value={form.dataNascimento || ""}
              onChange={handleChange}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Status</label>
            <select
              name="status"
              value={form.status || "ativo"}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Etapa do Funil</label>
            <select
              name="kanban_column_id"
              value={form.kanban_column_id || ""}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Selecione uma etapa</option>
              {columns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Seção: Filiação */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Filiação
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nome da Mãe</label>
            <input
              name="mae"
              value={form.mae || ""}
              onChange={handleChange}
              placeholder="Nome completo da mãe"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Nome do Pai</label>
            <input
              name="pai"
              value={form.pai || ""}
              onChange={handleChange}
              placeholder="Nome completo do pai"
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Sexo</label>
            <select
              name="sexo"
              value={form.sexo || ""}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Selecione</option>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
              <option value="Outro">Outro</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Naturalidade</label>
            <input
              name="naturalidade"
              value={form.naturalidade || ""}
              onChange={handleChange}
              placeholder="Cidade de nascimento"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Estado Civil</label>
            <select
              name="estadoCivil"
              value={form.estadoCivil || ""}
              onChange={handleChange}
              className={inputClass}
            >
              <option value="">Selecione</option>
              <option value="Solteiro">Solteiro(a)</option>
              <option value="Casado">Casado(a)</option>
              <option value="Divorciado">Divorciado(a)</option>
              <option value="Viúvo">Viúvo(a)</option>
              <option value="União Estável">União Estável</option>
            </select>
          </div>
        </div>

        {form.estadoCivil === "Casado" && (
          <div>
            <label className={labelClass}>Nome do Cônjuge</label>
            <input
              name="conjuge"
              value={form.conjuge || ""}
              onChange={handleChange}
              placeholder="Nome completo do cônjuge"
              className={inputClass}
            />
          </div>
        )}
      </div>

      {/* Seção: Endereço */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Endereço
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>CEP</label>
            <input
              name="cep"
              inputMode="numeric"
              value={form.cep || ""}
              onChange={handleChange}
              placeholder="00000-000"
              className={inputClass}
              maxLength={9}
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Rua/Logradouro</label>
            <input
              name="rua"
              value={form.rua || ""}
              onChange={handleChange}
              placeholder="Nome da rua"
              className={inputClass}
              maxLength={150}
            />
          </div>

          <div>
            <label className={labelClass}>Número</label>
            <input
              name="numero"
              value={form.numero || ""}
              onChange={handleChange}
              placeholder="Nº"
              className={inputClass}
              maxLength={10}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Complemento</label>
            <input
              name="complemento"
              value={form.complemento || ""}
              onChange={handleChange}
              placeholder="Apto, sala, etc"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Bairro</label>
            <input
              name="bairro"
              value={form.bairro || ""}
              onChange={handleChange}
              placeholder="Nome do bairro"
              className={inputClass}
              maxLength={100}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className={labelClass}>UF</label>
            <input
              name="uf"
              value={form.uf || ""}
              onChange={handleChange}
              placeholder="SP"
              className={inputClass}
              maxLength={2}
            />
          </div>

          <div className="md:col-span-3">
            <label className={labelClass}>Cidade</label>
            <input
              name="cidade"
              value={form.cidade || ""}
              onChange={handleChange}
              placeholder="Nome da cidade"
              className={inputClass}
              maxLength={100}
            />
          </div>
        </div>
      </div>

      {/* Seção: Contatos */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Contatos
        </h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Celular Principal</label>
            <input
              name="celular"
              inputMode="numeric"
              value={form.celular || ""}
              onChange={handleChange}
              placeholder="(00) 00000-0000"
              className={inputClass}
              maxLength={15}
            />
          </div>

          <div>
            <label className={labelClass}>Celular Alternativo</label>
            <input
              name="celularAlternativo"
              inputMode="numeric"
              value={form.celularAlternativo || ""}
              onChange={handleChange}
              placeholder="(00) 00000-0000"
              className={inputClass}
              maxLength={15}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Telefone</label>
            <input
              name="telefone"
              inputMode="numeric"
              value={form.telefone || ""}
              onChange={handleChange}
              placeholder="(00) 0000-0000"
              className={inputClass}
              maxLength={15}
            />
          </div>

          <div>
            <label className={labelClass}>Telefone Alternativo</label>
            <input
              name="telefoneAlternativo"
              inputMode="numeric"
              value={form.telefoneAlternativo || ""}
              onChange={handleChange}
              placeholder="(00) 0000-0000"
              className={inputClass}
              maxLength={15}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>E-mail</label>
            <input
              name="email"
              type="email"
              value={form.email || ""}
              onChange={handleChange}
              placeholder="email@exemplo.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Site</label>
            <input
              name="site"
              type="url"
              value={form.site || ""}
              onChange={handleChange}
              placeholder="https://exemplo.com"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Seção: Observações */}
      <div className="space-y-4">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Observações
        </h4>
        
        <div>
          <label className={labelClass}>Anotações Gerais</label>
          <textarea
            name="observacoes"
            value={form.observacoes || ""}
            onChange={handleChange}
            placeholder="Informações adicionais sobre o cliente..."
            className={`${inputClass} min-h-[100px] resize-y`}
            rows={4}
          />
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Salvando...
            </span>
          ) : (
            "Salvar Cliente"
          )}
        </button>
      </div>
    </form>
  );
}
