import React from "react";
import { useNavigate } from "react-router-dom";
import { ClienteForm } from "../../componets/clientes/ClienteForm";
import { fetchJson } from "../../lib/fetch";
import { showToast } from "../../hooks/useToast";

const API = import.meta.env.VITE_API_URL;

const ClienteCreate: React.FC = () => {
  const navigate = useNavigate();

  const handleSubmit = async (data: any) => {
    try {
      await fetchJson(`${API}/leads`, {
        method: "POST",
        body: JSON.stringify(data),
      });
      showToast("Cliente cadastrado com sucesso!", "success");
      navigate("/clientes");
    } catch (error: any) {
      showToast(error.message || "Erro ao cadastrar cliente", "error");
    }
  };

  return (
    <div className="w-full h-full">
      <ClienteForm 
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default ClienteCreate;
