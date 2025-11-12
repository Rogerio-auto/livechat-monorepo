import { FaTimes, FaSave } from 'react-icons/fa';
import { useState } from 'react';

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export type ProposalEdit = {
  id: string;
  number: string;
  title: string;
  total_value: number;
  valid_until?: string | null;
  description?: string | null;
};

type Props = {
  proposal: ProposalEdit;
  onClose: () => void;
  onSaved: () => void;
};

export default function ProposalEditModal({ proposal, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(proposal.title || '');
  const [total, setTotal] = useState<number>(Number(proposal.total_value || 0));
  const [validUntil, setValidUntil] = useState<string>(proposal.valid_until ? String(proposal.valid_until).slice(0,10) : '');
  const [description, setDescription] = useState<string>(proposal.description || '');
  const [saving, setSaving] = useState(false);

  const fetchJson = async (url: string, init?: RequestInit) => {
    const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...init });
    if (!res.ok) {
      let msg = '';
      try { const e = await res.json(); msg = e?.error || ''; } catch {}
      throw new Error(msg || `HTTP ${res.status}`);
    }
    return;
  };

  const salvar = async () => {
    try {
      setSaving(true);
      const payload: any = {
        title,
        total_value: total,
        valid_until: validUntil || null,
        description: description || null,
      };
      await fetchJson(`${API}/proposals/${proposal.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-[#204A34]">Editar Proposta {proposal.number}</h3>
          <button className="text-zinc-500 hover:text-zinc-800" onClick={onClose} disabled={saving}><FaTimes /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Título</label>
            <input className="w-full border rounded-lg p-2" value={title} onChange={e=>setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Valor Total (R$)</label>
            <input type="number" className="w-full border rounded-lg p-2" value={total} onChange={e=>setTotal(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Válido até</label>
            <input type="date" className="w-full border rounded-lg p-2" value={validUntil} onChange={e=>setValidUntil(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Descrição</label>
            <textarea className="w-full border rounded-lg p-2 min-h-24" value={description} onChange={e=>setDescription(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <button className="p-2 rounded-xl border" onClick={onClose} disabled={saving}><FaTimes /></button>
          <button className="px-4 py-2 rounded-xl bg-[#204A34] hover:bg-[#42CD55] text-white" onClick={salvar} disabled={saving} ><FaSave /></button>
        </div>
      </div>
    </div>
  );
}



