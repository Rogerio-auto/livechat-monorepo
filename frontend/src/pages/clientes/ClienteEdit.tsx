import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ClienteForm } from "../../components/clientes/ClienteForm";
import { API } from "../../utils/api";
import { fetchJson } from "../../lib/fetch";
import { showToast } from "../../hooks/useToast";

const ClienteEdit: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCliente(id);
    }
  }, [id]);

  const fetchCliente = async (clienteId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`${API}/leads/${clienteId}`, {
        credentials: "include"
      });
      if (response.ok) {
        const data = await response.json();
        setCliente(data);
      } else {
        showToast("Erro ao carregar dados do cliente", "error");
        navigate("/clientes");
      }
    } catch (error) {
      showToast("Erro ao carregar dados do cliente", "error");
      navigate("/clientes");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: any) => {
    if (!id) return;
    try {
      await fetchJson(`${API}/leads/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      showToast("Cliente atualizado com sucesso!", "success");
      navigate("/clientes");
    } catch (error: any) {
      showToast(error.message || "Erro ao atualizar cliente", "error");
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
      <ClienteForm 
        initialData={cliente}
        onSubmit={handleSubmit}
      />
    </div>
  );
};

export default ClienteEdit;
