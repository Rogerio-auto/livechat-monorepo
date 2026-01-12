import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  Task,
  TaskFilters,
  TaskStats,
  CreateTaskInput,
  UpdateTaskInput,
  TaskCreatedPayload,
  TaskUpdatedPayload,
  TaskAssignedPayload,
  TaskCompletedPayload,
  TaskDeletedPayload,
  TaskReminderPayload,
} from "@livechat/shared";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

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

function buildQueryString(filters: TaskFilters = {}): string {
  const params = new URLSearchParams();
  
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "all") {
      if (typeof value === "boolean") {
        params.append(key, value.toString());
      } else {
        params.append(key, String(value));
      }
    }
  });
  
  return params.toString();
}

// ========== useTasks Hook ==========
export function useTasks(initialFilters: TaskFilters = {}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(initialFilters);
  const socketRef = useRef<Socket | null>(null);

  const fetchTasks = useCallback(async (currentFilters: TaskFilters = {}) => {
    try {
      setLoading(true);
      setError(null);
      const query = buildQueryString(currentFilters);
      const url = `${API}/api/tasks${query ? `?${query}` : ""}`;
      const response = await fetchJson<{ tasks: Task[]; total: number }>(url);
      
      console.log("[useTasks] API response:", { url, response });
      
      // Backend returns {tasks: [], total: number}
      if (response && Array.isArray(response.tasks)) {
        setTasks(response.tasks);
      } else if (Array.isArray(response)) {
        // Fallback for direct array response
        setTasks(response as any);
      } else {
        console.warn("[useTasks] API returned unexpected data:", response);
        setTasks([]);
      }
    } catch (err: any) {
      console.error("[useTasks] Error fetching tasks:", err);
      setError(err.message || "Failed to load tasks");
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (input: CreateTaskInput): Promise<Task> => {
    const task = await fetchJson<Task>(`${API}/api/tasks`, {
      method: "POST",
      body: JSON.stringify(input),
    });
    
    // Socket.io will add via task:created event
    return task;
  }, []);

  const updateTask = useCallback(async (id: string, input: UpdateTaskInput): Promise<Task> => {
    const task = await fetchJson<Task>(`${API}/api/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
    
    // Socket.io will update via task:updated event
    return task;
  }, []);

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    await fetchJson<void>(`${API}/api/tasks/${id}`, {
      method: "DELETE",
    });
    
    // Socket.io will remove via task:deleted event
  }, []);

  const completeTask = useCallback(async (id: string): Promise<Task> => {
    const task = await fetchJson<Task>(`${API}/api/tasks/${id}/complete`, {
      method: "PATCH",
    });
    
    // Socket.io will update via task:completed event
    return task;
  }, []);

  // Socket.io real-time updates
  useEffect(() => {
    const socket = io(API, { withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[useTasks] Socket connected");
    });

    socket.on("task:created", (payload: TaskCreatedPayload) => {
      console.log("[useTasks] task:created", payload);
      setTasks((prev) => {
        // Check if task already exists (avoid duplicates)
        if (prev.some((t) => t.id === payload.task.id)) return prev;
        return [payload.task, ...prev];
      });
    });

    socket.on("task:updated", (payload: TaskUpdatedPayload) => {
      console.log("[useTasks] task:updated", payload);
      setTasks((prev) =>
        prev.map((t) => (t.id === payload.task.id ? payload.task : t))
      );
    });

    socket.on("task:assigned", (payload: TaskAssignedPayload) => {
      console.log("[useTasks] task:assigned", payload);
      setTasks((prev) => {
        // Check if task exists, if not add it (in case we're not on the page yet)
        const exists = prev.some((t) => t.id === payload.task.id);
        if (!exists) return [payload.task, ...prev];
        // Otherwise just update it
        return prev.map((t) => (t.id === payload.task.id ? payload.task : t));
      });
    });

    socket.on("task:completed", (payload: TaskCompletedPayload) => {
      console.log("[useTasks] task:completed", payload);
      setTasks((prev) =>
        prev.map((t) => (t.id === payload.task.id ? payload.task : t))
      );
    });

    socket.on("task:deleted", (payload: TaskDeletedPayload) => {
      console.log("[useTasks] task:deleted", payload);
      setTasks((prev) => prev.filter((t) => t.id !== payload.taskId));
    });

    socket.on("task:reminder", (payload: TaskReminderPayload) => {
      console.log("[useTasks] task:reminder", payload);
      // Could show a toast notification here
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Fetch tasks when filters change
  useEffect(() => {
    fetchTasks(filters);
  }, [filters, fetchTasks]);

  return {
    tasks,
    loading,
    error,
    filters,
    setFilters,
    refetch: () => fetchTasks(filters),
    createTask,
    updateTask,
    deleteTask,
    completeTask,
  };
}

// ========== useTaskStats Hook ==========
export function useTaskStats() {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchJson<TaskStats>(`${API}/api/tasks/stats`);
      setStats(data);
    } catch (err: any) {
      console.error("[useTaskStats] Error fetching stats:", err);
      setError(err.message || "Failed to load stats");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();

    // Connect to Socket.io to auto-refresh stats when tasks change
    const socket = io(API, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });

    // Refetch stats when any task event occurs
    socket.on("task:created", () => fetchStats());
    socket.on("task:updated", () => fetchStats());
    socket.on("task:completed", () => fetchStats());
    socket.on("task:deleted", () => fetchStats());

    return () => {
      socket.disconnect();
    };
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

// ========== useTaskById Hook ==========
export function useTaskById(id: string | null) {
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTask = useCallback(async (taskId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchJson<Task>(`${API}/api/tasks/${taskId}`);
      setTask(data);
    } catch (err: any) {
      console.error("[useTaskById] Error fetching task:", err);
      setError(err.message || "Failed to load task");
      setTask(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id) {
      fetchTask(id);
    } else {
      setTask(null);
      setError(null);
      setLoading(false);
    }
  }, [id, fetchTask]);

  return { task, loading, error, refetch: id ? () => fetchTask(id) : undefined };
}

// ========== useTasksByEntity Hook ==========
export function useTasksByEntity(
  entityType: "lead" | "customer" | "chat" | null,
  entityId: string | null
) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(
    async (type: string, id: string) => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchJson<Task[]>(
          `${API}/api/tasks/entity/${type}/${id}`
        );
        setTasks(data);
      } catch (err: any) {
        console.error("[useTasksByEntity] Error fetching tasks:", err);
        setError(err.message || "Failed to load tasks");
        setTasks([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (entityType && entityId) {
      fetchTasks(entityType, entityId);
    } else {
      setTasks([]);
      setError(null);
      setLoading(false);
    }
  }, [entityType, entityId, fetchTasks]);

  return {
    tasks,
    loading,
    error,
    refetch:
      entityType && entityId
        ? () => fetchTasks(entityType, entityId)
        : undefined,
  };
}
