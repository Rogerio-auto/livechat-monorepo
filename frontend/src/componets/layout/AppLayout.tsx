import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "../Sidbars/sidebar";
import { TopBar } from "./TopBar";

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <Sidebar mobileOpen={mobileOpen} onRequestClose={() => setMobileOpen(false)} />

      <div className="flex min-h-screen flex-col lg:pl-[var(--sidebar-expanded-width,18rem)]">
        <TopBar onMenuClick={() => setMobileOpen(true)} />

        <main className="app-shell flex-1 py-6">
          <div className="app-shell__inner space-y-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
