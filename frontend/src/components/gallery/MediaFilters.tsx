import { FiSearch, FiFilter, FiX } from "react-icons/fi";

type Filters = {
  media_type: string;
  category: string;
  search: string;
  is_active: string;
};

interface MediaFiltersProps {
  filters: Filters;
  onFilterChange: (filters: Filters) => void;
}

const CONTROL_CLASS =
  "config-input rounded-xl border border-transparent bg-(--color-surface) px-3 py-2 text-sm text-(--color-text) shadow-sm transition focus:border-[rgba(47,180,99,0.35)] focus:outline-none";
const SEARCH_CLASS =
  "config-input w-full rounded-xl border border-transparent bg-(--color-surface) pl-10 pr-3 py-2 text-sm text-(--color-text) shadow-sm transition focus:border-[rgba(47,180,99,0.35)] focus:outline-none";

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
    <div className="rounded-xl bg-[color-mix(in_srgb,var(--color-muted) 72%,transparent)] px-5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-(--color-text-muted)">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface) text-(--color-primary)">
            <FiFilter className="h-3.5 w-3.5" />
          </span>
          Refinar biblioteca
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-(--color-surface) px-4 py-2 text-xs font-semibold text-(--color-text) transition hover:border-[rgba(47,180,99,0.35)] hover:text-(--color-primary)"
          >
            <FiX className="h-4 w-4" />
            Limpar filtros
          </button>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="relative flex-1 min-w-[220px]">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--color-text-muted)" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
            className={SEARCH_CLASS}
            placeholder="Busque por título, descrição ou nome do arquivo..."
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <select
            value={filters.media_type}
            onChange={(e) => onFilterChange({ ...filters, media_type: e.target.value })}
            className={`${CONTROL_CLASS} min-w-[170px]`}
          >
            <option value="">Todos os tipos</option>
            <option value="image">Imagens</option>
            <option value="video">Vídeos</option>
            <option value="document">Documentos</option>
            <option value="audio">Áudios</option>
          </select>
          <select
            value={filters.category}
            onChange={(e) => onFilterChange({ ...filters, category: e.target.value })}
            className={`${CONTROL_CLASS} min-w-[170px]`}
          >
            <option value="">Todas categorias</option>
            <option value="product">Produto</option>
            <option value="service">Serviço</option>
            <option value="marketing">Marketing</option>
            <option value="documentation">Documentação</option>
            <option value="other">Outro</option>
          </select>
          <select
            value={filters.is_active}
            onChange={(e) => onFilterChange({ ...filters, is_active: e.target.value })}
            className={`${CONTROL_CLASS} min-w-[150px]`}
          >
            <option value="true">Ativos</option>
            <option value="false">Inativos</option>
            <option value="">Todos</option>
          </select>
        </div>
      </div>
    </div>
  );
}

