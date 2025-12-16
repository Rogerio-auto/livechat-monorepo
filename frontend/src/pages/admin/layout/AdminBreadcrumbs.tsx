import { Link, useLocation } from 'react-router-dom';
import { FiChevronRight } from 'react-icons/fi';
import { useAdminNav } from './AdminNavContext';

const LABELS: Record<string, string> = {
  admin: 'Admin',
  dashboard: 'Dashboard',
  companies: 'Empresas',
  infrastructure: 'Infraestrutura',
  overview: 'Visão Geral',
  agents: 'Agentes',
  users: 'Usuários',
  logs: 'Logs',
};

function formatSegment(segment: string) {
  if (/^[0-9a-f-]{8,}$/i.test(segment)) {
    return `ID ${segment.slice(0, 6).toUpperCase()}`;
  }
  return segment
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function AdminBreadcrumbs() {
  const location = useLocation();
  const { labels } = useAdminNav();
  const segments = location.pathname.split('/').filter(Boolean);
  const adminIndex = segments.indexOf('admin');

  if (adminIndex === -1) {
    return null;
  }

  const relevant = segments.slice(adminIndex);
  const crumbs = relevant.map((segment, index) => {
    const label = labels[segment] ?? LABELS[segment] ?? formatSegment(segment);
    const to = `/${segments.slice(0, adminIndex).concat(relevant.slice(0, index + 1)).join('/')}`;
    const isLast = index === relevant.length - 1;

    return { label, to, isLast };
  });

  return (
    <nav className="flex items-center gap-2 text-sm text-slate-400">
      {crumbs.map((crumb, index) => (
        <span key={crumb.to} className="flex items-center gap-2">
          {crumb.isLast ? (
            <span className="font-medium text-white">{crumb.label}</span>
          ) : (
            <Link to={crumb.to} className="transition hover:text-white">
              {crumb.label}
            </Link>
          )}
          {index < crumbs.length - 1 && <FiChevronRight className="text-xs opacity-60" />}
        </span>
      ))}
    </nav>
  );
}
