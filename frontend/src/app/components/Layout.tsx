import { Outlet, Link, useNavigate } from "react-router";
import { LogOut, LayoutDashboard, Calendar, FileText, Users, BarChart3, Church } from "lucide-react";

interface LayoutProps {
  role: "requester" | "approver" | "admin";
}

export function Layout({ role }: LayoutProps) {
  const navigate = useNavigate();

  const handleLogout = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      {/* Modern Header with gradient */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200/60 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 flex-shrink-0">
                <img src="/logo.png" alt="San Pedro Cathedral Logo" className="w-10 h-10 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <div className="-mt-10">
                  <Church className="w-10 h-10 text-slate-900" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                  San Pedro Cathedral
                </h1>
                <p className="text-sm text-slate-600 mt-0.5">
                  Venue & Facilities Management
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-slate-100 rounded-lg">
                <span className="text-sm text-slate-600">
                  <span className="capitalize font-medium text-slate-900">{role}</span>
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg hover:bg-slate-50 transition-all"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Modern Navigation with icons */}
      <nav className="bg-white/60 backdrop-blur-sm border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {role === "requester" && (
              <>
                <Link
                  to="/requester"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:text-slate-900 hover:bg-white rounded-t-lg transition-all"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link
                  to="/requester/availability"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:text-slate-900 hover:bg-white rounded-t-lg transition-all"
                >
                  <Calendar className="w-4 h-4" />
                  Venue Availability
                </Link>
              </>
            )}
            {role === "approver" && (
              <>
                <Link
                  to="/approver"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:text-slate-900 hover:bg-white rounded-t-lg transition-all"
                >
                  <FileText className="w-4 h-4" />
                  Pending Approvals
                </Link>
                <Link
                  to="/approver/availability"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:text-slate-900 hover:bg-white rounded-t-lg transition-all"
                >
                  <Calendar className="w-4 h-4" />
                  Venue Availability
                </Link>
              </>
            )}
            {role === "admin" && (
              <>
                <Link
                  to="/admin"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:text-slate-900 hover:bg-white rounded-t-lg transition-all"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  Dashboard
                </Link>
                <Link
                  to="/admin/audit-log"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:text-slate-900 hover:bg-white rounded-t-lg transition-all"
                >
                  <BarChart3 className="w-4 h-4" />
                  Audit Log & Reports
                </Link>
                <Link
                  to="/admin/availability"
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:text-slate-900 hover:bg-white rounded-t-lg transition-all"
                >
                  <Calendar className="w-4 h-4" />
                  Venue Availability
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>

      {/* Modern Footer */}
      <footer className="bg-white/60 backdrop-blur-sm border-t border-slate-200/60 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <p className="text-sm text-slate-500 text-center">
            San Pedro Cathedral Venue Management System © 2026
          </p>
        </div>
      </footer>
    </div>
  );
}