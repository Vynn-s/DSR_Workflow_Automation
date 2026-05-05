import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { LogIn, Church, Shield, Calendar, Users } from "lucide-react";
import { useAuth, UserRole } from "../../context/AuthContext";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const role = await login(email, password);

      if (role === UserRole.REQUESTER) {
        navigate("/requester");
      } else if (role === UserRole.PARISH_SECRETARY || role === UserRole.PARISH_PRIEST) {
        navigate("/approver");
      } else if (role === UserRole.ADMIN) {
        navigate("/admin");
      } else {
        navigate("/");
      }
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : "Unable to sign in";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Panel - Branding & Information */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-blue-400 rounded-full blur-3xl"></div>
        </div>

        {/* Geometric Pattern Overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
          backgroundSize: '48px 48px'
        }}></div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          {/* Logo & Title */}
          <div>
            <div className="flex items-center gap-3 mb-8">
              <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl border border-white/20">
                <Church className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  San Pedro Cathedral
                </h1>
                <p className="text-sm text-blue-200 mt-0.5">
                  Venue & Facilities Management
                </p>
              </div>
            </div>

            <div className="space-y-1 mt-16 mb-12">
              <h2 className="text-4xl font-semibold leading-tight">
                Streamlined
                <br />
                Venue Management
              </h2>
              <p className="text-lg text-blue-200 mt-4 max-w-md leading-relaxed">
                Efficiently manage bookings, approvals, and facility operations
                with our comprehensive workflow automation system.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-4 mt-12">
              <div className="flex items-start gap-3 group">
                <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                  <Calendar className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-medium">Smart Scheduling</h3>
                  <p className="text-sm text-blue-200 mt-0.5">
                    Real-time availability and conflict detection
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 group">
                <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                  <Shield className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-medium">Secure Approvals</h3>
                  <p className="text-sm text-blue-200 mt-0.5">
                    Multi-level verification with digital signatures
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 group">
                <div className="p-2 bg-white/10 rounded-lg group-hover:bg-white/20 transition-colors">
                  <Users className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h3 className="font-medium">Role-Based Access</h3>
                  <p className="text-sm text-blue-200 mt-0.5">
                    Customized workflows for all user types
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="border-t border-white/10 pt-6">
            <p className="text-sm text-blue-200">
              Designed for San Pedro Cathedral © 2026
            </p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 lg:p-12 bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile Header */}
          <div className="lg:hidden text-center mb-10">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                <Church className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900">
                San Pedro Cathedral
              </h1>
            </div>
            <p className="text-sm text-slate-600">
              Venue & Facilities Management System
            </p>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/10 overflow-hidden">
            {/* Card Header with Accent */}
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-30"></div>
              <div className="relative">
                <h2 className="text-2xl font-semibold text-white">
                  Welcome Back
                </h2>
                <p className="text-sm text-blue-100 mt-1">
                  Sign in to access your account
                </p>
              </div>
            </div>

            {/* Form Content */}
            <div className="px-8 py-10">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Email / Username
                  </label>
                  <input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="block text-sm font-medium text-slate-700"
                    >
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-sm text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      Forgot?
                    </button>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all text-slate-900 placeholder:text-slate-400"
                    placeholder="Enter your password"
                    required
                  />
                </div>

                <div className="flex items-center">
                  <input
                    id="remember"
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-2"
                  />
                  <label
                    htmlFor="remember"
                    className="ml-2 text-sm text-slate-600"
                  >
                    Remember me for 30 days
                  </label>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-900/25 hover:shadow-xl hover:shadow-blue-900/30 flex items-center justify-center gap-2 font-medium"
                >
                  <LogIn className="w-5 h-5" />
                  {isLoading ? "Signing in..." : "Sign In to Account"}
                </button>
              </form>

              {error ? (
                <p className="mt-6 text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

            </div>
          </div>

          {/* Additional Links */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">
              Need assistance?{" "}
              <button className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
                Contact Support
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}