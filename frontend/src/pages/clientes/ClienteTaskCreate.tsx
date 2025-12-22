import { useNavigate, useParams } from "react-router-dom";
import { TaskForm } from "../../components/tasks/TaskForm";
import type { CreateTaskInput, UpdateTaskInput } from "../../types/tasks";

const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

export default function ClienteTaskCreate() {
  const navigate = useNavigate();
  const { id } = useParams();

  const handleSubmit = async (data: CreateTaskInput | UpdateTaskInput) => {
    try {
      const response = await fetch(`${API}/tasks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Erro ao criar tarefa");
      }

      navigate(`/clientes/${id}`);
    } catch (error: any) {
      console.error("[ClienteTaskCreate] Error creating task:", error);
      throw error;
    }
  };

  return (
    <div className="w-full h-full">
      <TaskForm
        onSubmit={handleSubmit}
        onClose={() => navigate(`/clientes/${id}`)}
        prefilledData={{
          related_lead_id: id,
        }}
        isModal={false}
        breadcrumb="Clientes"
        formTitle="Nova Tarefa para Cliente"
      />
    </div>
  );
}
