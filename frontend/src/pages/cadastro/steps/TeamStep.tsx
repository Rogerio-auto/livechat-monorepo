import { useState, useEffect } from "react";
import { FaUserPlus, FaEnvelope, FaTrash, FaPaperPlane } from "react-icons/fa";

interface Props {
  onSave: (emails: string[]) => void;
}

export function TeamStep({ onSave }: Props) {
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");

  useEffect(() => {
    onSave(emails);
  }, [emails]);

  const addEmail = () => {
    if (newEmail.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim()) && !emails.includes(newEmail.trim())) {
      setEmails([...emails, newEmail.trim()]);
      setNewEmail("");
    }
  };

  const removeEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email));
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2 text-center">
        <h2 className="text-3xl font-bold text-slate-900">Convide sua Equipe</h2>
        <p className="text-slate-500">Adicione os e-mails dos seus colaboradores para que eles possam acessar a plataforma.</p>
      </div>
      
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-4 flex items-center text-slate-400">
              <FaEnvelope size={14} />
            </div>
            <input 
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addEmail()}
              placeholder="email@exemplo.com"
              className="w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 py-3 text-sm outline-none focus:border-[#2fb463] focus:ring-2 focus:ring-[#2fb463]/10 transition-all"
            />
          </div>
          <button 
            onClick={addEmail}
            className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white hover:bg-slate-800 transition-all"
          >
            <FaUserPlus /> Convidar
          </button>
        </div>

        <div className="space-y-2">
          {emails.map((email) => (
            <div 
              key={email}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  <FaEnvelope size={12} />
                </div>
                <span className="text-sm font-medium text-slate-700">{email}</span>
              </div>
              <button 
                onClick={() => removeEmail(email)}
                className="text-slate-300 hover:text-red-500 transition-colors"
              >
                <FaTrash size={12} />
              </button>
            </div>
          ))}
        </div>

        {emails.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-100 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-300">
              <FaUserPlus size={20} />
            </div>
            <p className="text-sm text-slate-400">Nenhum convite pendente.</p>
            <p className="text-xs text-slate-400 mt-1">Você também poderá convidar sua equipe depois.</p>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-4 text-blue-700">
            <FaPaperPlane size={14} />
            <p className="text-xs font-medium">Os convites serão enviados assim que você finalizar o onboarding.</p>
          </div>
        )}
      </div>
    </div>
  );
}
