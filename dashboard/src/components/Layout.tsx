import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth.js";

const LINKS = [
  { to: "/", label: "Monitores", end: true },
  { to: "/incidents", label: "Incidentes", end: false },
  { to: "/settings", label: "Ajustes", end: false },
];

function useTheme(): [string, () => void] {
  const [theme, setTheme] = useState(() => localStorage.getItem("tempo-theme") ?? "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("tempo-theme", theme);
  }, [theme]);

  return [theme, () => setTheme((current) => (current === "dark" ? "light" : "dark"))];
}

export function OfflineBanner({ connected }: { connected: boolean }) {
  if (connected) {
    return null;
  }

  return (
    <div
      role="alert"
      className="border-b border-warn/40 bg-warn/10 px-4 py-2 text-center text-sm text-warn"
    >
      Sin conexión en vivo con el servidor. Lo que ves puede estar desactualizado.
    </div>
  );
}

export function Layout({ children, connected }: { children: ReactNode; connected: boolean }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();

  async function logout() {
    await signOut();
    await navigate("/login");
  }

  return (
    <div className="min-h-full">
      <OfflineBanner connected={connected} />

      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <span className="text-lg font-semibold tracking-tight">
            tempo<span className="text-accent">.</span>
          </span>

          <nav className="flex gap-1" aria-label="Principal">
            {LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-md px-2.5 py-1.5 text-sm transition ${
                    isActive ? "bg-raised text-ink" : "text-dim hover:text-ink"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 text-sm">
            <a href="/status" className="text-dim transition hover:text-ink">
              status público
            </a>
            <button
              onClick={toggleTheme}
              className="text-dim transition hover:text-ink"
              aria-label={`Cambiar a tema ${theme === "dark" ? "claro" : "oscuro"}`}
            >
              {theme === "dark" ? "☀" : "☾"}
            </button>
            <span className="hidden text-dim sm:inline">{user?.email}</span>
            <button onClick={() => void logout()} className="text-dim transition hover:text-ink">
              salir
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
