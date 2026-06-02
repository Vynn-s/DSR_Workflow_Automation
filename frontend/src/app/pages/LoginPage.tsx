import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Lock, Mail, Moon, Shield, Sparkles, Sun, User } from "lucide-react";
import { useAuth, UserRole } from "../../context/AuthContext";



export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("theme") as "light" | "dark" | null) ?? "dark";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const role = await login(email, password);

      if (role === UserRole.REQUESTER) {
        navigate("/requester");
      } else if (role === UserRole.PARISH_SECRETARY) {
        navigate("/approver");
      } else if (role === UserRole.ADMIN || role === UserRole.PARISH_PRIEST) {
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
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex items-center justify-center p-4 text-slate-950 dark:text-zinc-100">
      <button
        type="button"
        onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
        className="fixed right-5 top-5 z-10 p-2 rounded-xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-400 hover:text-slate-950 dark:hover:text-white transition-all"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
      </button>
      <div className="bg-white dark:bg-[#121214] rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-2xl max-w-4xl w-full overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
        <div className="md:col-span-5 bg-gradient-to-b from-[#0F3B8C] to-[#0d1e3d] p-8 flex flex-col justify-between relative border-r border-zinc-900 text-center overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-center gap-2">
            <img src="/logo.png" alt="San Pedro Cathedral Logo" className="w-5 h-5 object-contain" />
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">San Pedro Cathedral</span>
          </div>

          <div className="w-full max-w-[210px] mx-auto aspect-square bg-white rounded-full p-4 relative flex flex-col justify-center items-center shadow-2xl border-4 border-amber-400">
            <img src="/logo.png" alt="San Pedro Cathedral Logo" className="w-full h-full object-contain" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-400">Archdiocese of Davao</p>
            <p className="text-[9px] text-zinc-400">Official scheduling gatekeeper interface</p>
          </div>
        </div>

        <div className="md:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-white dark:bg-[#121214]">
          <div className="max-w-sm w-full mx-auto space-y-6 text-left">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">Welcome to San Pedro Cathedral Portal</h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">Please sign in with your parish credentials to continue.</p>
            </div>

            {error ? (
              <p className="p-3.5 bg-red-950/40 border border-red-500/20 rounded-xl text-red-400 text-xs font-semibold" role="alert">
                {error}
              </p>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
                  <input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white dark:bg-[#18181b] border border-slate-300 dark:border-zinc-800 focus:border-[#0F3B8C] rounded-xl pl-10 pr-4 py-3 text-xs text-slate-950 dark:text-zinc-100 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                    placeholder="you@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="password" className="block text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    Password
                  </label>
                  <button type="button" className="text-[11px] text-[#00A859] hover:underline font-bold">
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white dark:bg-[#18181b] border border-slate-300 dark:border-zinc-800 focus:border-[#0F3B8C] rounded-xl pl-10 pr-10 py-3 text-xs text-slate-950 dark:text-zinc-100 outline-none transition-all font-semibold placeholder:text-slate-400 dark:placeholder:text-zinc-600"
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl bg-[#0F3B8C] dark:bg-white text-white dark:text-zinc-950 font-bold text-xs hover:bg-[#0d3276] dark:hover:bg-zinc-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? "Verifying parish credentials..." : "Continue to Portal"}
              </button>
            </form>

            <div className="space-y-2 pt-4 border-t border-slate-200 dark:border-zinc-900">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest block mb-2">Quick Select Preset Role</span>
              <button
                type="button"
                onClick={() => { setEmail("requester@test.com"); setPassword("Password123!"); }}
                className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-700 dark:text-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                <User className="w-4 h-4 text-zinc-400" /> Staff Requester (requester@test.com)
              </button>
              <button
                type="button"
                onClick={() => { setEmail("approver@test.com"); setPassword("Password123!"); }}
                className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-700 dark:text-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4 text-[#00A859]" /> Parish Approver (approver@test.com)
              </button>
              <button
                type="button"
                onClick={() => { setEmail("admin@sanpedro.cathedral.org"); setPassword("Password123!"); }}
                className="w-full py-2.5 px-3 rounded-xl bg-white dark:bg-[#18181b] hover:bg-slate-50 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 text-[11px] font-bold text-slate-700 dark:text-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> Administrator (admin@sanpedro.cathedral.org)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
