// frontend/src/components/projects/ProjectTasks.tsx

import { useState, useEffect } from "react";
import { fetchJson } from "../../lib/fetch";
import { 
  Plus, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Calendar,
  User as UserIcon,
  Edit2,
  X,
  Check
} from "lucide-react";
import { Button } from "../ui";

const API = import.meta.env.VITE_API_URL;

interface Task {
  id: string;
  title: string;
  description?: string;
  is_completed: boolean;
  due_date?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  completed_at?: string;
  assigned_to?: string;
  assigned_user?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

interface User {
  id: string;
  name: string;
  avatar?: string;
}

export default function ProjectTasks({ projectId }: { projectId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState({ title: '', priority: 'medium', assigned_to: '' });
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Task>>({});

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, [projectId]);

  const loadTasks = async () => {
    try {
      const data = await fetchJson<Task[]>(`${API}/projects/${projectId}/tasks`);
      setTasks(data);
    } catch (err) {
      console.error('Erro ao carregar tarefas:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const data = await fetchJson<User[]>(`${API}/api/users/company`);
      setUsers(data);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    setAdding(true);
    try {
      const payload = {
        ...newTask,
        assigned_to: newTask.assigned_to || undefined
      };
      const task = await fetchJson<Task>(`${API}/projects/${projectId}/tasks`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setTasks([...tasks, task]);
      setNewTask({ title: '', priority: 'medium', assigned_to: '' });
    } catch (err) {
      console.error('Erro ao adicionar tarefa:', err);
    } finally {
      setAdding(false);
    }
  };

  const toggleTask = async (task: Task) => {
    try {
      const newStatus = !task.is_completed;
      const updated = await fetchJson<Task>(`${API}/projects/tasks/${task.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_completed: newStatus })
      });
      setTasks(tasks.map(t => t.id === task.id ? updated : t));
    } catch (err) {
      console.error('Erro ao atualizar tarefa:', err);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm('Excluir esta tarefa?')) return;
    try {
      await fetchJson(`${API}/projects/tasks/${taskId}`, { method: 'DELETE' });
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Erro ao excluir tarefa:', err);
    }
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      priority: task.priority,
      assigned_to: task.assigned_to || ''
    });
  };

  const saveEdit = async (taskId: string) => {
    try {
      const updated = await fetchJson<Task>(`${API}/projects/tasks/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(editForm)
      });
      setTasks(tasks.map(t => t.id === taskId ? updated : t));
      setEditingId(null);
    } catch (err) {
      console.error('Erro ao salvar tarefa:', err);
    }
  };

  const completedCount = tasks.filter((t) => t.is_completed).length;
  const progressPercentage =
    tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-(--color-primary) border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Summary */}
      <div className="bg-(--color-surface-muted) rounded-xl p-6 border border-(--color-border)">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-(--color-text)">
            Progresso das Tarefas
          </h3>
          <span className="text-2xl font-bold text-(--color-primary)">
            {completedCount}/{tasks.length}
          </span>
        </div>
        <div className="w-full bg-(--color-bg) rounded-full h-3">
          <div
            className="bg-(--color-primary) h-3 rounded-full transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <p className="text-sm text-(--color-text-muted) mt-2">
          {progressPercentage}% concluído
        </p>
      </div>

      {/* Add Task Form */}
      <form onSubmit={handleAddTask} className="bg-(--color-surface) p-4 rounded-xl border border-(--color-border) space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            placeholder="Nova tarefa..."
            className="flex-1 bg-(--color-bg) border border-(--color-border) rounded-lg px-4 py-2 text-sm text-(--color-text) focus:ring-2 focus:ring-(--color-primary) outline-none"
          />
          <button 
            type="submit" 
            disabled={adding || !newTask.title.trim()}
            className="px-4 py-2 bg-(--color-primary) text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {adding ? "..." : <Plus size={20} />}
          </button>
        </div>
        <div className="flex gap-2">
          <select
            value={newTask.priority}
            onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as any })}
            className="flex-1 bg-(--color-bg) border border-(--color-border) rounded-lg px-3 py-2 text-xs text-(--color-text) outline-none"
          >
            <option value="low">Baixa Prioridade</option>
            <option value="medium">Média Prioridade</option>
            <option value="high">Alta Prioridade</option>
            <option value="urgent">Urgente</option>
          </select>
          <select
            value={newTask.assigned_to}
            onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
            className="flex-1 bg-(--color-bg) border border-(--color-border) rounded-lg px-3 py-2 text-xs text-(--color-text) outline-none"
          >
            <option value="">Sem responsável</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>
      </form>

      {/* Tasks List */}
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-12 text-(--color-text-muted)">
            <div className="text-4xl mb-2">✅</div>
            <p>Nenhuma tarefa criada ainda</p>
          </div>
        ) : (
          tasks.map((task) => (
            <div 
              key={task.id}
              className={`group flex flex-col p-3 rounded-xl border transition-all ${
                task.is_completed 
                  ? 'bg-(--color-surface-muted) border-transparent opacity-60' 
                  : 'bg-(--color-surface) border-(--color-border) hover:border-(--color-primary)'
              }`}
            >
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => toggleTask(task)}
                  className={`transition-colors ${task.is_completed ? 'text-green-500' : 'text-(--color-text-muted) hover:text-(--color-primary)'}`}
                >
                  {task.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                </button>

                <div className="flex-1 min-w-0">
                  {editingId === task.id ? (
                    <input
                      autoFocus
                      type="text"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                      className="w-full bg-transparent border-b border-(--color-primary) outline-none text-sm font-medium py-0.5 text-(--color-text)"
                    />
                  ) : (
                    <p className={`text-sm font-medium truncate ${task.is_completed ? 'line-through text-(--color-text-muted)' : 'text-(--color-text)'}`}>
                      {task.title}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {editingId === task.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => saveEdit(task.id)} className="p-1 text-green-600 hover:bg-green-500/10 rounded"><Check size={16}/></button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-red-600 hover:bg-red-500/10 rounded"><X size={16}/></button>
                    </div>
                  ) : (
                    <>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      <button 
                        onClick={() => startEditing(task)}
                        className="p-1.5 text-(--color-text-muted) hover:text-(--color-primary) opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={() => deleteTask(task.id)}
                        className="p-1.5 text-(--color-text-muted) hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Task Footer (Responsible & Date) */}
              <div className="mt-2 pl-8 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {editingId === task.id ? (
                    <select
                      value={editForm.assigned_to}
                      onChange={(e) => setEditForm({ ...editForm, assigned_to: e.target.value })}
                      className="text-[10px] bg-(--color-bg) border border-(--color-border) rounded px-1 py-0.5 outline-none text-(--color-text)"
                    >
                      <option value="">Sem responsável</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-1.5 text-[10px] text-(--color-text-muted)">
                      {task.assigned_user ? (
                        <>
                          <div className="w-4 h-4 rounded-full bg-(--color-primary)/10 flex items-center justify-center text-(--color-primary) overflow-hidden">
                            {task.assigned_user.avatar ? (
                              <img src={task.assigned_user.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={10} />
                            )}
                          </div>
                          <span>{task.assigned_user.name}</span>
                        </>
                      ) : (
                        <span className="italic opacity-50">Sem responsável</span>
                      )}
                    </div>
                  )}

                  {task.due_date && (
                    <div className="flex items-center gap-1 text-[10px] text-(--color-text-muted)">
                      <Calendar size={10} />
                      {new Date(task.due_date).toLocaleDateString()}
                    </div>
                  )}
                </div>

                {editingId === task.id && (
                  <select
                    value={editForm.priority}
                    onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as any })}
                    className="text-[10px] bg-(--color-bg) border border-(--color-border) rounded px-1 py-0.5 outline-none text-(--color-text)"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="urgent">Urgente</option>
                  </select>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'urgent': return 'bg-red-500/10 text-red-500';
    case 'high': return 'bg-orange-500/10 text-orange-500';
    case 'medium': return 'bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]';
    default: return 'bg-gray-500/10 text-gray-500';
  }
}
