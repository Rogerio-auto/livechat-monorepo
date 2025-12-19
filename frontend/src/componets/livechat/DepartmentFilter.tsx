import { useEffect, useState } from "react";
import { FiFilter, FiX } from "react-icons/fi";
import { getAccessToken } from "../../utils/api";

type Department = {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  active_chats: number;
  total_chats: number;
};

type DepartmentFilterProps = {
  selectedDepartmentId: string | null;
  onSelectDepartment: (departmentId: string | null) => void;
  refreshKey?: number;
};

export function DepartmentFilter({ selectedDepartmentId, onSelectDepartment, refreshKey = 0 }: DepartmentFilterProps) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);

  const API = import.meta.env.VITE_API_URL?.replace(/\/$/, "") || "http://localhost:5000";

  useEffect(() => {
    loadDepartments();
  }, [refreshKey]);

  const loadDepartments = async () => {
    try {
      const token = getAccessToken();
      const headers = new Headers();
      if (token) headers.set("Authorization", `Bearer ${token}`);

      const res = await fetch(`${API}/api/departments/stats/summary`, {
        headers,
        credentials: "include",
      });
      
      if (res.ok) {
        const data = await res.json();
        setDepartments(data);
      }
    } catch (error) {
      console.error("Erro ao carregar departamentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const selectedDept = departments.find(d => d.id === selectedDepartmentId);

  const handleSelect = (deptId: string | null) => {
    onSelectDepartment(deptId);
    setShowDropdown(false);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500">
        <FiFilter size={16} />
        <span>Carregando...</span>
      </div>
    );
  }

  if (departments.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
          selectedDepartmentId
            ? "bg-blue-50 border-blue-300 text-blue-700"
            : "bg-white border-gray-300 hover:border-gray-400"
        }`}
      >
        <FiFilter size={16} />
        <span className="text-sm font-medium">
          {selectedDept ? selectedDept.name : "Todos os Departamentos"}
        </span>
        {selectedDept && (
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: selectedDept.color || "#6366F1" }}
          />
        )}
        {selectedDepartmentId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(null);
            }}
            className="ml-1 hover:bg-blue-100 rounded p-0.5"
          >
            <FiX size={14} />
          </button>
        )}
      </button>

      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full mt-2 left-0 z-20 w-72 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <button
                onClick={() => handleSelect(null)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                  !selectedDepartmentId
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "hover:bg-gray-50"
                }`}
              >
                <span>Todos os Departamentos</span>
                {!selectedDepartmentId && (
                  <span className="text-xs text-blue-600">✓</span>
                )}
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-2">
              {departments.map((dept) => (
                <button
                  key={dept.id}
                  onClick={() => handleSelect(dept.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedDepartmentId === dept.id
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: dept.color || "#6366F1" }}
                    />
                    <span className="truncate">{dept.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-3 ml-2">
                    {dept.active_chats > 0 && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                        {dept.active_chats}
                      </span>
                    )}
                    {selectedDepartmentId === dept.id && (
                      <span className="text-xs text-blue-600">✓</span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="p-2 border-t border-gray-100 bg-gray-50">
              <div className="text-xs text-gray-500 px-3 py-1">
                Total: {departments.reduce((sum, d) => sum + d.total_chats, 0)} conversas
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
