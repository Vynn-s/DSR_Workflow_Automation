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
    `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
      isActive
        ? "bg-[#0F3B8C] text-white"
        : "border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-zinc-100"
    }`;

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-950 dark:bg-[#030712] dark:text-zinc-100" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Modern Header with gradient */}
      <header className="sticky top-0 z-50 bg-white/85 dark:bg-[#030712]/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-gradient-to-tr from-[#0F3B8C] via-[#00A859] to-[#C99700] p-0.5 ring ring-white/10 flex-shrink-0">
                <div className="w-10 h-10 rounded-full bg-[#030712] flex items-center justify-center overflow-hidden">
                  <img src="/logo.png" alt="San Pedro Cathedral Logo" className="w-9 h-9 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              </div>
              <div>
                <h1 className="font-bold text-sm tracking-wide flex items-center gap-2 text-slate-950 dark:text-zinc-100">
                  <span>San Pedro Cathedral</span>
                  <span className="text-[10px] bg-[#00A859]/10 text-[#00A859] px-2 py-0.5 rounded-full font-bold border border-[#00A859]/20">DSR Live</span>
                </h1>
                <p className="text-[10px] text-zinc-400 font-medium">
                  Venue & Facilities Management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
                className="p-2 rounded-xl bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white transition-all"
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              >
                {theme === "dark" ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
              </button>
              <div className="px-4 py-2 bg-slate-100 dark:bg-zinc-900/80 border border-slate-200 dark:border-zinc-800 rounded-xl">
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  <span className="capitalize font-black text-slate-950 dark:text-zinc-100">{role}</span>
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-xs font-black text-slate-500 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white border border-slate-200 dark:border-zinc-800 rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-900 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modern Navigation with icons */}
      <nav className="border-b border-slate-200 dark:border-zinc-900 bg-white/85 dark:bg-[#030712]">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {role === "requester" && (
              <>
                <NavLink
                  to="/requester"
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
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>

      {/* Modern Footer */}
      <footer className="bg-white border-t border-slate-200 text-slate-500 dark:bg-[#030712] dark:border-zinc-900 dark:text-zinc-400 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-sm text-slate-500 dark:text-zinc-400 text-center">
            San Pedro Cathedral Venue Management System © 2026
          </p>
        </div>
      </footer>
    </div>
  );
}
