import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { TaskForm } from "../../components/tasks/TaskForm";
import { useTasks } from "../../hooks/useTasks";
import { API } from "../../utils/api";
import { ArrowLeft } from "lucide-react";
import type { Task, UpdateTaskInput } from "../../types/tasks";

const TaskEdit: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { updateTask } = useTasks();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchTask(id);
    }
  }, [id]);

  const fetchTask = async (taskId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/api/tasks/${taskId}`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setTask(data);
      } else {
        console.error("Failed to fetch task");
        navigate("/tarefas");
      }
    } catch (error) {
      console.error("Error fetching task:", error);
      navigate("/tarefas");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: UpdateTaskInput) => {
    if (id) {
      await updateTask(id, data);
      navigate("/tarefas");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2fb463]"></div>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <TaskForm
        initialData={task}
        onSubmit={handleSubmit}
        onClose={() => navigate("/tarefas")}
        isModal={false}
      />
    </div>
  );
};

export default TaskEdit;
