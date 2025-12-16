import { FiServer, FiShield, FiZap } from 'react-icons/fi';

const ITEMS = [
  { title: 'Filas & Workers', description: 'Monitoramento dos jobs críticos', icon: FiZap },
  { title: 'Cache & Storage', description: 'Status do Redis e Supabase', icon: FiServer },
  { title: 'Segurança', description: 'Webhooks, tokens e auditorias', icon: FiShield },
];

export function SystemHealth() {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Infraestrutura</p>
        <h2 className="mt-2 text-3xl font-semibold">Status Operacional</h2>
        <p className="text-sm text-slate-400">
          Este módulo será conectado aos serviços de observabilidade nas próximas fases.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {ITEMS.map((item) => (
          <div key={item.title} className="rounded-3xl border border-white/5 bg-slate-900/60 p-6">
            <item.icon className="text-2xl text-slate-200" />
            <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
            <p className="text-sm text-slate-400">{item.description}</p>
            <div className="mt-6 rounded-2xl border border-dashed border-white/10 p-4 text-center text-slate-500">
              Em construção
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
