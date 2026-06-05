import { useEffect, useState } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import { LogOut, LayoutDashboard, Calendar, FileText, BarChart3, Moon, Sun } from "lucide-react";

interface LayoutProps {
  role: "requester" | "approver" | "admin";
}

export function Layout({ role }: LayoutProps) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as "light" | "dark" | null) ?? "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const navLinkClassName = ({ isActive }: { isActive: boolean }) =>
    `relative flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2 text-xs font-semibold transition-all duration-150 active:scale-95 motion-reduce:transition-none motion-reduce:transform-none ${
      isActive
        ? "border-[#0F3B8C] bg-[#0F3B8C] text-white shadow-sm after:absolute after:inset-x-4 after:-bottom-[17px] after:h-0.5 after:rounded-full after:bg-[#00A859] dark:text-white"
        : "border-zinc-300 bg-transparent text-zinc-600 hover:-translate-y-0.5 hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 hover:shadow-sm dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-200"
    }`;

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-zinc-900 dark:bg-[#030712] dark:text-zinc-100" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Modern Header with gradient */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-zinc-200 dark:bg-[#030712]/80 dark:border-zinc-900">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-gradient-to-tr from-[#0F3B8C] via-[#00A859] to-[#C99700] p-0.5 ring ring-white/10 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center overflow-hidden dark:bg-[#030712]">
                  <img src="/logo.png" alt="San Pedro Cathedral Logo" className="w-9 h-9 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-wide flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                  <span>San Pedro Cathedral</span>
                  <span className="text-[10px] bg-[#00A859]/10 text-[#00A859] px-2 py-0.5 rounded-full font-bold border border-[#00A859]/20">DSR Live</span>
                </h1>
                <p className="text-[10px] text-zinc-500 font-medium dark:text-zinc-400">
                  Venue & Facilities Management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
                className="p-1 rounded-lg bg-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-all duration-150 active:scale-95 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
              </button>
              <div className="px-4 py-2 bg-zinc-100 border border-zinc-200 rounded-xl dark:bg-zinc-900/80 dark:border-zinc-800">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="capitalize font-black text-zinc-900 dark:text-zinc-100">{role}</span>
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 border border-zinc-300 bg-transparent text-zinc-700 rounded-xl px-4 py-2.5 text-sm hover:border-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-all duration-150 active:scale-95 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modern Navigation with icons */}
      <nav className="border-b border-zinc-200 bg-white/85 dark:border-zinc-900 dark:bg-[#030712]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
            {role === "requester" && (
              <>
                <NavLink
                  to="/requester"
                  end
                  className={navLinkClassName}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </NavLink>
                <NavLink
                  to="/requester/availability"
                  className={navLinkClassName}
                >
                  <Calendar className="w-4 h-4" />
                  Venue Availability
                </NavLink>
              </>
            )}
            {role === "approver" && (
              <>
                <NavLink
                  to="/approver"
                  end
                  className={navLinkClassName}
                >
                  <FileText className="w-4 h-4" />
                  Pending Approvals
                </NavLink>
                <NavLink
                  to="/approver/availability"
                  className={navLinkClassName}
                >
                  <Calendar className="w-4 h-4" />
                  Venue Availability
                </NavLink>
              </>
            )}
            {role === "admin" && (
              <>
                <NavLink
                  to="/admin"
                  end
                  className={navLinkClassName}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </NavLink>
                <NavLink
                  to="/admin/audit-log"
                  className={navLinkClassName}
                >
                  <BarChart3 className="w-4 h-4" />
                  Audit Log & Reports
                </NavLink>
                <NavLink
                  to="/admin/availability"
                  className={navLinkClassName}
                >
                  <Calendar className="w-4 h-4" />
                  Venue Availability
                </NavLink>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <Outlet />
      </main>

      {/* Modern Footer */}
      <footer className="bg-white border-t border-zinc-200 text-zinc-400 dark:text-zinc-500 mt-auto dark:bg-[#030712] dark:border-zinc-900 dark:text-zinc-400">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center dark:text-zinc-400">
            San Pedro Cathedral Venue Management System © 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
