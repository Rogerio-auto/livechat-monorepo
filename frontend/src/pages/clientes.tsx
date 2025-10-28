import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../componets/Sidbars/sidebar";
import { ClienteForm } from "../componets/clientes/ClienteForm";
import { formatCPF } from "../utils/format";
import { API } from "../utils/api";

type Cliente = {
  id: string;
  name: string;
  cpf?: string;
  email?: string;
  status: string;
  kanban_column_id?: string;
};

type KanbanColumn = { id: string; name: string };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [columns, setColumns] = useState<KanbanColumn[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const navigate = useNavigate();

  const requireAuth = async () => {
    try {
      await fetchJson(`${API}/auth/me`);
      return true;
    } catch {
      navigate("/login");
      return false;
    }
  };

  useEffect(() => {
    (async () => {
      const ok = await requireAuth();
      if (!ok) return;
      try {
        const [clientesData, board] = await Promise.all([
          fetchJson<Cliente[]>(`${API}/leads`),
          fetchJson<{ id?: string | null }>(`${API}/kanban/my-board`).catch(() => null),
        ]);
        setClientes(clientesData);
        if (board?.id) {
          const cols = await fetchJson<Array<{ id: string; name?: string; title?: string }>>(
            `${API}/kanban/boards/${board.id}/columns`,
          ).catch(() => []);
          setColumns(
            (cols || []).map((column) => ({
              id: column.id,
              name: column.name ?? column.title ?? "Sem titulo",
            })),
          );
        }
      } catch (err) {
        console.error(err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormSubmit = async (payload: any) => {
    const ok = await requireAuth();
    if (!ok) return;

    try {
      if (editingCliente) {
        const updated = await fetchJson<Cliente>(`${API}/leads/${editingCliente.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        setClientes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else {
        const created = await fetchJson<Cliente>(`${API}/leads`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setClientes((prev) => [created, ...prev]);
      }
      setShowForm(false);
      setEditingCliente(null);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar cliente");
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await requireAuth();
    if (!ok) return;
    if (!window.confirm("Tem certeza que deseja excluir?")) return;

    try {
      await fetch(`${API}/leads/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      setClientes((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      console.error(err);
      alert("Erro ao excluir cliente");
    }
  };

  return (
    <>
      <Sidebar />
      <div className="ml-16 min-h-screen bg-[var(--color-bg)] p-8 text-[var(--color-text)] transition-colors duration-300">
        <div className="mt-8 rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[0_24px_60px_-40px_rgba(8,12,20,0.9)]">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-[var(--color-heading)]">Clientes</h2>
            <button
              type="button"
              onClick={() => {
                setEditingCliente(null);
                setShowForm(true);
              }}
              className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-on-primary)] transition-colors duration-200 hover:bg-[var(--color-primary-strong)]"
            >
              + Novo Cliente
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-[var(--color-surface-muted)]/60 text-[var(--color-text-muted)]">
                <tr className="uppercase tracking-wide text-xs">
                  <th className="px-3 py-3">Nome</th>
                  <th className="px-3 py-3">CPF</th>
                  <th className="px-3 py-3">Email</th>
                  <th className="px-3 py-3">Etapa</th>
                  <th className="px-3 py-3">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="border-t border-[color:var(--color-border)] text-[var(--color-text-muted)] transition-colors duration-150 hover:bg-[var(--color-surface-muted)]/40"
                  >
                    <td className="px-3 py-2 text-[var(--color-heading)]">{cliente.name}</td>
                    <td className="px-3 py-2">{cliente.cpf ? formatCPF(cliente.cpf) : "-"}</td>
                    <td className="px-3 py-2">{cliente.email || "-"}</td>
                    <td className="px-3 py-2">
                      {columns.find((c) => c.id === cliente.kanban_column_id)?.name || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="Criar proposta"
                          onClick={() =>
                            navigate("/documentos", {
                              state: {
                                lead: {
                                  id: cliente.id,
                                  name: cliente.name,
                                  email: cliente.email,
                                },
                              },
                            })
                          }
                          className="rounded p-1.5 text-[var(--color-highlight)] transition-colors duration-150 hover:bg-[var(--color-highlight)]/15"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-5 w-5"
                          >
                            <path d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375H16.5V7.5a3 3 0 00-3-3H7.125a3.375 3.375 0 00-3.375 3.375v9.75A3.375 3.375 0 007.125 21h9.75A3.375 3.375 0 0020.25 17.625V16.5a2.25 2.25 0 00-.75-1.659v-.591z" />
                            <path d="M15 3.75H9.75A2.25 2.25 0 007.5 6v.75h6.75A3.75 3.75 0 0118 10.5v1.5h.75a.75.75 0 010 1.5H18v1.5a2.25 2.25 0 01-2.25 2.25H7.5V18a.75.75 0 011.5 0v1.5h6a3 3 0 003-3V6A2.25 2.25 0 0015 3.75z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => {
                            setEditingCliente(cliente);
                            setShowForm(true);
                          }}
                          className="rounded p-1.5 text-[var(--color-primary)] transition-colors duration-150 hover:bg-[var(--color-primary)]/15"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-5 w-5"
                          >
                            <path d="M21.731 2.269a2.625 2.625 0 00-3.714 0l-1.086 1.086 3.714 3.714 1.086-1.086a2.625 2.625 0 000-3.714z" />
                            <path d="M3 17.25V21h3.75L19.314 8.436l-3.714-3.714L3 17.25z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Excluir"
                          onClick={() => handleDelete(cliente.id)}
                          className="rounded p-1.5 text-red-500 transition-colors duration-150 hover:bg-red-500/10"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-5 w-5"
                          >
                            <path d="M9 3a1 1 0 00-1 1v1H5.5a.75.75 0 000 1.5h13a.75.75 0 000-1.5H16V4a1 1 0 00-1-1H9z" />
                            <path
                              fillRule="evenodd"
                              d="M6.75 7.5A.75.75 0 016 8.25v10.5A3.75 3.75 0 009.75 22.5h4.5A3.75 3.75 0 0018 18.75V8.25a.75.75 0 00-.75-.75h-10.5zM9 10.5a.75.75 0 011.5 0v8.25a.75.75 0 01-1.5 0V10.5zm4.5 0a.75.75 0 011.5 0v8.25a.75.75 0 01-1.5 0V10.5z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {clientes.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-[var(--color-text-muted)]"
                    >
                      Nenhum cliente encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-overlay)]/80 backdrop-blur-sm">
            <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6 text-[var(--color-text)] shadow-[0_24px_60px_-40px_rgba(8,12,20,0.9)]">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="absolute right-3 top-3 text-sm font-semibold text-[var(--color-text-muted)] transition-colors duration-150 hover:text-[var(--color-heading)]"
              >
                Fechar
              </button>
              <h3 className="mb-4 text-lg font-semibold text-[var(--color-heading)]">
                {editingCliente ? "Editar Cliente" : "Novo Cliente"}
              </h3>
              <ClienteForm initialData={editingCliente} onSubmit={handleFormSubmit} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
