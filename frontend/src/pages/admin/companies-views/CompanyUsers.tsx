import { useOutletContext } from 'react-router-dom';
import { CompanyOutletContext } from '@livechat/shared';

export function CompanyUsers() {
  const { company, analytics } = useOutletContext<CompanyOutletContext>();
  const totalUsers = analytics?.counts.users ?? 0;

  return (
    <div className="space-y-6 rounded-xl border border-white/5 bg-slate-900/70 p-8 text-slate-200">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Usuários</h3>
          <p className="mt-2 text-sm text-slate-400">
            Operadores, gestores e owners vinculados a {company?.name ?? 'esta empresa'}.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Usuários totais</p>
          <p className="mt-2 text-3xl font-semibold text-white">{totalUsers}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-white/15 p-6 text-sm text-slate-400">
        A listagem completa com filtros por papel e status ficará disponível na próxima fase.
        Até lá, utilize o onboarding interno para alterações críticas.
      </div>
    </div>
  );
}

