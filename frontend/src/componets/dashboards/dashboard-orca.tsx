import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import Sidebar from "../Sidbars/sidebar";
import DataTable from "../tabelacli";

const conversionData = [
  { name: "Jun/25", value: 9.66, color: "#1D4ED8" },
  { name: "Jul/25", value: 10.75, color: "#38BDF8" },
  { name: "Ago/25", value: 8.89, color: "#94A3B8" },
];

const salesQuantity = [
  { name: "Mar/25", orcamentos: 0, vendas: 0 },
  { name: "Abr/25", orcamentos: 0, vendas: 0 },
  { name: "Mai/25", orcamentos: 0, vendas: 0 },
  { name: "Jun/25", orcamentos: 5, vendas: 2 },
  { name: "Jul/25", orcamentos: 15, vendas: 10 },
  { name: "Ago/25", orcamentos: 35, vendas: 20 },
];

const salesValues = [
  { name: "Mar/25", value: 0 },
  { name: "Abr/25", value: 0 },
  { name: "Mai/25", value: 0 },
  { name: "Jun/25", value: 20000 },
  { name: "Jul/25", value: 45000 },
  { name: "Ago/25", value: 100000 },
];

const pendingSummary = [
  { label: "Check list inicial", count: 3 },
  { label: "Check list final", count: 1 },
  { label: "Pendencias", count: 2 },
];

const infoFeed = [
  {
    title: "Seja bem-vindo a plataforma",
    description: "Explore os novos recursos do painel modernizado.",
    date: "01/01/25",
  },
];

const cardBase =
  "rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] shadow-[0_28px_60px_-45px_rgba(8,12,20,0.9)] transition-colors duration-300";

export function DashOrca() {
  return (
    <>
      <Sidebar />
      <div className="ml-16 transition-all duration-300 ease-in-out">
        <main className="grid grid-cols-12 gap-6 p-6 text-[var(--color-text)]">
          <section
            className={`${cardBase} col-span-12 flex flex-col items-center gap-3 p-6 text-center lg:col-span-3`}
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-highlight)]/20 text-[var(--color-highlight)]">
              <i className="fas fa-user text-3xl" aria-hidden />
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-heading)]">
              Rogerio
            </h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Orcamentos do mes:{" "}
              <span className="font-semibold text-[var(--color-heading)]">
                1.190.607,66
              </span>
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">
              Vendas do mes:{" "}
              <span className="font-semibold text-[var(--color-heading)]">
                105.903,00
              </span>
            </p>
            <button
              type="button"
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] shadow-sm transition-colors duration-200 hover:bg-[var(--color-primary-strong)]"
            >
              Funcionario: Todos
            </button>
          </section>

          <section
            className={`${cardBase} col-span-12 p-6 lg:col-span-3 text-[var(--color-text)]`}
          >
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Conversao
            </h3>
            <div className="flex justify-between gap-4">
              {conversionData.map((item) => {
                const chartData = [
                  { name: "valor", value: item.value },
                  { name: "restante", value: Math.max(0, 100 - item.value) },
                ];
                return (
                  <div
                    key={item.name}
                    className="flex flex-1 flex-col items-center gap-2 rounded-xl bg-[var(--color-surface-muted)] p-3"
                  >
                    <PieChart width={90} height={90}>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={40}
                        startAngle={90}
                        endAngle={-270}
                      >
                        <Cell fill={item.color} />
                        <Cell fill="rgba(148,163,184,0.15)" />
                      </Pie>
                    </PieChart>
                    <p className="text-sm font-semibold text-[var(--color-heading)]">
                      {item.value}%
                    </p>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {item.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <section
            className={`${cardBase} col-span-12 p-6 lg:col-span-6`}
          >
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Ultimos orcamentos e vendas
            </h3>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-muted)]/40 p-2">
              <DataTable />
            </div>
          </section>

          <section
            className={`${cardBase} col-span-12 p-6 lg:col-span-6`}
          >
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Quantidades de orcamentos e vendas
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesQuantity}>
                <XAxis dataKey="name" stroke="var(--color-text-muted)" />
                <YAxis stroke="var(--color-text-muted)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
                <Bar dataKey="orcamentos" radius={[6, 6, 0, 0]} fill="#1D4ED8" />
                <Bar dataKey="vendas" radius={[6, 6, 0, 0]} fill="#38BDF8" />
              </BarChart>
            </ResponsiveContainer>
          </section>

          <section
            className={`${cardBase} col-span-12 p-6 lg:col-span-3`}
          >
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Pendencias
            </h3>
            <ul className="space-y-2 text-sm">
              {pendingSummary.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center justify-between rounded-lg bg-[var(--color-surface-muted)] px-3 py-2"
                >
                  <span className="text-[var(--color-heading)]">
                    {item.label}
                  </span>
                  <span className="rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-xs font-semibold text-[var(--color-on-primary)] shadow-sm">
                    {item.count}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`${cardBase} col-span-12 p-6 lg:col-span-3`}
          >
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Atualizacoes recentes
            </h3>
            <ul className="space-y-3 text-sm">
              {infoFeed.map((info) => (
                <li
                  key={info.title}
                  className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface-muted)]/50 p-3"
                >
                  <p className="font-medium text-[var(--color-heading)]">
                    {info.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {info.description}
                  </p>
                  <span className="mt-2 inline-block text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
                    {info.date}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className={`${cardBase} col-span-12 p-6 lg:col-span-6`}
          >
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Valores de vendas
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={salesValues} layout="vertical" barGap={12}>
                <XAxis type="number" stroke="var(--color-text-muted)" />
                <YAxis dataKey="name" type="category" stroke="var(--color-text-muted)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                />
                <Bar dataKey="value" fill="#1D4ED8" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </section>
        </main>
      </div>
    </>
  );
}
