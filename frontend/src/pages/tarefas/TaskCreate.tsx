import { useNavigate } from "react-router-dom";
import { TaskForm } from "../../components/tasks/TaskForm";
import { useTasks } from "../../hooks/useTasks";
import { ArrowLeft } from "lucide-react";
import { CreateTaskInput, UpdateTaskInput } from "@livechat/shared";

export default function TaskCreate() {
  const navigate = useNavigate();
  const { createTask } = useTasks();

  const handleSubmit = async (data: CreateTaskInput | UpdateTaskInput) => {
    await createTask(data as CreateTaskInput);
    navigate("/tarefas");
  };

  return (
    <div className="w-full h-full">
      <TaskForm
        onSubmit={handleSubmit}
        onClose={() => navigate("/tarefas")}
        isModal={false}
      />
    </div>
  );
}
