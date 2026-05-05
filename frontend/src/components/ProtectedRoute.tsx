import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { useAuth } from "../context/AuthContext";

interface ProtectedRouteProps {
  allowedRoles: string[];
  redirectTo?: string;
}

function LoadingSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900" />
    </div>
  );
}

export function ProtectedRoute({ allowedRoles, redirectTo = "/" }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.pathname === "/unauthorized") {
      window.location.replace("/");
    }
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to={redirectTo} replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    if (typeof window !== "undefined") {
      window.location.assign("/");
      window.sessionStorage.setItem("authMessage", "Unauthorized access");
    }

    return <Navigate to="/" replace state={{ from: location, message: "Unauthorized access" }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
