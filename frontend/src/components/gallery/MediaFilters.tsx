import { FiSearch, FiFilter, FiX } from "react-icons/fi";

interface MediaFiltersProps {
  filters: {
    media_type: string;
    category: string;
    search: string;
    is_active: string;
  };
  onFilterChange: (filters: any) => void;
}

export default function MediaFilters({ filters, onFilterChange }: MediaFiltersProps) {
  const hasActiveFilters =
    filters.media_type || filters.category || filters.search || filters.is_active !== "true";

  const clearFilters = () => {
    onFilterChange({
      media_type: "",
      category: "",
      search: "",
      is_active: "true",
    });
  };

  return (
    <div 
      className="rounded-xl border p-4 theme-surface-muted mb-6"
      style={{ borderColor: "color-mix(in srgb, var(--color-border) 60%, transparent)" }}
    >
      <div className="flex items-center gap-4 flex-wrap">
        {/* Search */}
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FiSearch className="h-5 w-5 theme-text-muted" />
            </div>
            <input
              type="text"
              value={filters.search}
              onChange={(e) =>
                onFilterChange({ ...filters, search: e.target.value })
              }
              className="block w-full pl-10 pr-3 py-2 border rounded-lg theme-input text-sm"
              style={{ borderColor: "var(--color-border)" }}
              placeholder="Buscar por título, descrição ou nome do arquivo..."
            />
          </div>
        </div>

        {/* Media Type */}
        <div className="w-[180px]">
          <select
            value={filters.media_type}
            onChange={(e) =>
              onFilterChange({ ...filters, media_type: e.target.value })
            }
            className="block w-full px-3 py-2 border rounded-lg theme-input text-sm"
            style={{ borderColor: "var(--color-border)" }}
          >
            <option value="">Todos os tipos</option>
            <option value="image">Imagens</option>
            <option value="video">Vídeos</option>
            <option value="document">Documentos</option>
            <option value="audio">Áudios</option>
          </select>
        </div>

        {/* Category */}
        <div className="w-[180px]">
          <select
            value={filters.category}
            onChange={(e) =>
              onFilterChange({ ...filters, category: e.target.value })
            }
            className="block w-full px-3 py-2 border rounded-lg theme-input text-sm"
            style={{ borderColor: "var(--color-border)" }}
          >
            <option value="">Todas categorias</option>
            <option value="product">Produto</option>
            <option value="service">Serviço</option>
            <option value="marketing">Marketing</option>
            <option value="documentation">Documentação</option>
            <option value="other">Outro</option>
          </select>
        </div>

        {/* Status */}
        <div className="w-[150px]">
          <select
            value={filters.is_active}
            onChange={(e) =>
              onFilterChange({ ...filters, is_active: e.target.value })
            }
            className="block w-full px-3 py-2 border rounded-lg theme-input text-sm"
            style={{ borderColor: "var(--color-border)" }}
          >
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
            <option value="">Todos</option>
          </select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center px-3 py-2 border rounded-lg text-sm theme-secondary transition"
            style={{ borderColor: "var(--color-border)" }}
          >
            <FiX className="h-4 w-4 mr-1" />
            Limpar
          </button>
        )}
      </div>
    </div>
  );
}
