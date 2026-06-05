import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  allowedRoles: string[];
}

const roleDashboards: Record<string, string> = {
  REQUESTER: "/requester",
  PARISH_SECRETARY: "/approver",
  PARISH_PRIEST: "/admin",
  ADMIN: "/admin",
};

function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
    </div>
  );
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to={roleDashboards[user.role] ?? "/login"} replace />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
