import { Outlet } from "react-router-dom";

import { Header } from "./Header";
import { Footer } from "./Footer";
import { ScrollToTop } from "./ScrollToTop";

export const LayoutShell = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white text-slate-900">
      <ScrollToTop />
      <Header />
      <main className="relative z-0 bg-grid-light">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};
