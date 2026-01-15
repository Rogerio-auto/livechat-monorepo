import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FiMenu, FiX } from "react-icons/fi";
import clsx from "clsx";

import { Button } from "../ui/Button";
import { NAV_LINKS } from "../../utils/constants";

const Brand = () => (
  <Link to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900">
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">7S</span>
    <div className="leading-tight">
      <span>7Sion Platform</span>
      <p className="text-xs font-normal text-slate-500">Omnichannel AI</p>
    </div>
  </Link>
);

export const Header = () => {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const handleNavClick = () => setOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-white/70 backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Brand />

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 lg:flex">
          {NAV_LINKS.map((link) => {
            const isAnchor = link.path.includes("#");
            const baseClasses = clsx(
              "transition-colors hover:text-primary",
              location.pathname === link.path.replace(/#.*/, "") && !isAnchor && "text-primary",
            );

            return isAnchor ? (
              <a key={link.label} href={link.path} className={baseClasses}>
                {link.label}
              </a>
            ) : (
              <Link key={link.label} to={link.path} className={baseClasses}>
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Button variant="ghost" size="sm" href="/demo">
            Ver Demo
          </Button>
          <Button size="sm" href="/#precos">
            Começar Grátis
          </Button>
        </div>

        <button
          className="inline-flex items-center rounded-full border border-slate-200 p-2 text-slate-600 lg:hidden"
          onClick={() => setOpen((state) => !state)}
          aria-label="Abrir menu"
        >
          {open ? <FiX className="text-xl" /> : <FiMenu className="text-xl" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/30 bg-white/90 px-4 py-4 shadow-lg lg:hidden">
          <nav className="flex flex-col gap-3 text-sm font-medium text-slate-700">
            {NAV_LINKS.map((link) =>
              link.path.includes("#") ? (
                <a key={link.label} href={link.path} onClick={handleNavClick}>
                  {link.label}
                </a>
              ) : (
                <Link key={link.label} to={link.path} onClick={handleNavClick}>
                  {link.label}
                </Link>
              ),
            )}
          </nav>
          <div className="mt-4 flex flex-col gap-3">
            <Button variant="secondary" href="/demo" onClick={handleNavClick}>
              Ver Demo
            </Button>
            <Button href="/#precos" onClick={handleNavClick}>
              Ver Planos
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
