import { Outlet } from 'react-router-dom';
import { AdminSidebar } from './AdminSidebar';
import { AdminBreadcrumbs } from './AdminBreadcrumbs';
import { AdminNavProvider } from './AdminNavContext';

export function AdminLayout() {
  return (
    <AdminNavProvider>
      <div className="h-screen bg-slate-950 text-white">
        <div className="flex h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-950 overflow-hidden">
          <AdminSidebar />
          <div className="flex flex-1 flex-col backdrop-blur">
            <header className="sticky top-0 z-10 border-b border-white/5 bg-slate-950/80 px-6 py-4">
              <AdminBreadcrumbs />
            </header>
            <main className="flex-1 overflow-y-auto px-6 py-8">
              <div className="mx-auto max-w-7xl space-y-8">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </AdminNavProvider>
  );
}
