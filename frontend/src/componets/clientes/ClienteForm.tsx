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
  cpf: "", nome: "", rg: "", orgao: "",
  dataNascimento: "",
  mae: "", pai: "", sexo: "", naturalidade: "",
  estadoCivil: "", conjuge: "",
  cep: "", rua: "", numero: "", complemento: "", bairro: "", uf: "", cidade: "",
  celular: "", celularAlternativo: "", telefone: "", telefoneAlternativo: "",
  email: "", site: "", observacoes: "",
  status: "Ativo",
};

export function ClienteForm({ initialData, onSubmit }: ClienteFormProps) {
  const [form, setForm] = useState<any>({ ...DEFAULTS, ...(initialData ?? {}) });
  const [columns, setColumns] = useState<Array<{ id: string; name: string }>>([]);

  // Atualiza quando abrir para edição
  useEffect(() => {
    setForm((prev: any) => ({ ...prev, ...(initialData ?? {}) }));
  }, [initialData]);

  // Carrega colunas do kanban (Etapa)
  useEffect(() => {
    (async () => {
      try {
        const API = (import.meta as any).env?.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";
        const resMe = await fetch(`${API}/auth/me`, { credentials: 'include' });
        if (!resMe.ok) return;
        const resBoard = await fetch(`${API}/kanban/my-board`, { credentials: 'include' });
        const board = await resBoard.json().catch(() => null);
        if (board?.id) {
          const resCols = await fetch(`${API}/kanban/boards/${board.id}/columns`, { credentials: 'include' });
          const cols = await resCols.json().catch(() => []);
          setColumns((cols || []).map((c: any) => ({ id: c.id, name: c.name ?? c.title })));
        }
      } catch {}
    })();
  }, []);

  // formata para exibição conforme o campo
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>
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
      // os demais não precisam de formatação especial
    };

    const fmt = formatMap[name];
    const next = fmt ? fmt(value) : value;

    setForm((prev: any) => ({ ...prev, [name]: next ?? "" }));
  };

  // normaliza para o backend (payload limpo)
  const sanitize = (d: any) => ({
    ...d,
    cpf: unformatCPF(d.cpf),
    cep: unformatCEP(d.cep),
    celular: unformatPhoneBR(d.celular),
    celularAlternativo: unformatPhoneBR(d.celularAlternativo),
    telefone: unformatPhoneBR(d.telefone),
    telefoneAlternativo: unformatPhoneBR(d.telefoneAlternativo),
    uf: normUF(d.uf),
    numero: normNumero(d.numero),
    dataNascimento: d.dataNascimento ? toISODate(d.dataNascimento) : "",
    email: (d.email || "").trim(),
    site: (d.site || "").trim(),
    kanban_column_id: d.kanban_column_id || d.etapa || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(sanitize(form));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Tipo Pessoa */}
      <div>
        <label className="block text-sm font-medium">Tipo de Pessoa</label>
        <select
          name="tipoPessoa"
          value={form.tipoPessoa ?? ""}
          onChange={handleChange}
          className="  bg-gray-200 p-2 w-full"
        >
          <option value="Física">Física</option>
          <option value="Jurídica">Jurídica</option>
        </select>
      </div>

      {/* CPF e Nome */}
      <div className="grid grid-cols-2 gap-4">
        <input
          name="cpf"
          inputMode="numeric"
          value={form.cpf ?? ""}
          onChange={handleChange}
          placeholder="CPF"
          className="  bg-gray-200 p-2"
          maxLength={14} // 000.000.000-00
        />
        <input
          name="nome"
          value={form.nome ?? ""}
          onChange={handleChange}
          placeholder="Nome"
          className="  bg-gray-200 p-2"
        />
      </div>

      {/* RG, Órgão, Data Nascimento */}
      <div className="grid grid-cols-3 gap-4">
        <input
          name="rg"
          value={form.rg ?? ""}
          onChange={handleChange}
          placeholder="RG"
          className="  bg-gray-200 p-2"
        />
        <input
          name="orgao"
          value={form.orgao ?? ""}
          onChange={handleChange}
          placeholder="Órgão"
          className="  bg-gray-200 p-2"
          maxLength={50}
        />
        <input
          type="date"
          name="dataNascimento"
          value={form.dataNascimento ?? ""}
          onChange={handleChange}
          className="  bg-gray-200 p-2"
        />
      </div>

      {/* Pais */}
      <div className="grid grid-cols-2 gap-4">
        <input name="mae" value={form.mae ?? ""} onChange={handleChange} placeholder="Mãe" className="  bg-gray-200 p-2" />
        <input name="pai" value={form.pai ?? ""} onChange={handleChange} placeholder="Pai" className="  bg-gray-200 p-2" />
      </div>

      {/* Sexo, Naturalidade */}
      <div className="grid grid-cols-2 gap-4">
        <input name="sexo" value={form.sexo ?? ""} onChange={handleChange} placeholder="Sexo" className="  bg-gray-200 p-2" />
        <input name="naturalidade" value={form.naturalidade ?? ""} onChange={handleChange} placeholder="Naturalidade" className="  bg-gray-200 p-2" />
      </div>

      {/* Estado Civil, Cônjuge */}
      <div className="grid grid-cols-2 gap-4">
        <input name="estadoCivil" value={form.estadoCivil ?? ""} onChange={handleChange} placeholder="Estado Civil" className="  bg-gray-200 p-2" />
        <input name="conjuge" value={form.conjuge ?? ""} onChange={handleChange} placeholder="Cônjuge" className="  bg-gray-200  p-2" />
      </div>

      {/* Endereço */}
      <div className="grid grid-cols-4 gap-4">
        <input
          name="cep"
          inputMode="numeric"
          value={form.cep ?? ""}
          onChange={handleChange}
          placeholder="CEP"
          className="  bg-gray-200 p-2"
          maxLength={9} // 00000-000
        />
        <input
          name="rua"
          value={form.rua ?? ""}
          onChange={handleChange}
          placeholder="Rua"
          className="  bg-gray-200 p-2 col-span-2"
          maxLength={150}
        />
        <input
          name="numero"
          value={form.numero ?? ""}
          onChange={handleChange}
          placeholder="Nº"
          className="  bg-gray-200 p-2"
          maxLength={10}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input name="complemento" value={form.complemento ?? ""} onChange={handleChange} placeholder="Complemento" className="  bg-gray-200 p-2" />
        <input name="bairro" value={form.bairro ?? ""} onChange={handleChange} placeholder="Bairro" className="  bg-gray-200 p-2" maxLength={100} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input
          name="uf"
          value={form.uf ?? ""}
          onChange={handleChange}
          placeholder="UF"
          className="  bg-gray-200 p-2"
          maxLength={2}
        />
        <input name="cidade" value={form.cidade ?? ""} onChange={handleChange} placeholder="Cidade" className="  bg-gray-200 p-2" maxLength={100} />
      </div>

      {/* Contatos */}
      <div className="grid grid-cols-2 gap-4">
        <input name="celular" inputMode="numeric" value={form.celular ?? ""} onChange={handleChange} placeholder="Celular" className="  bg-gray-200 p-2" maxLength={15} />
        <input name="celularAlternativo" inputMode="numeric" value={form.celularAlternativo ?? ""} onChange={handleChange} placeholder="Celular Alternativo" className="  bg-gray-200 p-2" maxLength={15} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input name="telefone" inputMode="numeric" value={form.telefone ?? ""} onChange={handleChange} placeholder="Telefone" className="  bg-gray-200 p-2" maxLength={15} />
        <input name="telefoneAlternativo" inputMode="numeric" value={form.telefoneAlternativo ?? ""} onChange={handleChange} placeholder="Telefone Alternativo" className="  bg-gray-200 p-2" maxLength={15} />
      </div>

      {/* Email e Site */}
      <div className="grid grid-cols-2 gap-4">
        <input name="email" value={form.email ?? ""} onChange={handleChange} placeholder="Email" className="  bg-gray-200 p-2" />
        <input name="site" value={form.site ?? ""} onChange={handleChange} placeholder="Site" className="  bg-gray-200 p-2" />
      </div>

      {/* Observações */}
      <textarea
        name="observacoes"
        value={form.observacoes ?? ""}
        onChange={handleChange}
        placeholder="Observações"
        className="  bg-gray-200 p-2 w-full"
      />

      {/* Etapa (Kanban) */}
      <div>
        <label className="block text-sm font-medium">Etapa</label>
        <select
          name="kanban_column_id"
          value={form.kanban_column_id || ""}
          onChange={handleChange}
          className="  bg-gray-200 p-2 w-full"
        >
          <option value="">Selecione...</option>
          {columns.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="flex justify-end">
        <button type="submit" className="bg-[#204A34] text-white px-4 py-2 rounded-xl hover:bg-[#42CD55] transition">
          Salvar
        </button>
      </div>
    </form>
  );
}
