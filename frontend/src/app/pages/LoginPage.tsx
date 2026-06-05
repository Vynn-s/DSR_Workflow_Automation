import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";
import { Eye, EyeOff, Lock, Mail, Moon, Sun } from "lucide-react";
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
      const role = await login(email.trim(), password);

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
    <div className="min-h-screen bg-white dark:bg-[#030712] flex items-center justify-center p-4 text-zinc-900 dark:text-zinc-100">
      <button
        type="button"
        onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
        className="fixed right-5 top-5 z-10 p-2 rounded-xl bg-white dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors duration-150"
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun className="w-4 h-4 text-amber-300" /> : <Moon className="w-4 h-4" />}
      </button>
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 shadow-2xl max-w-4xl w-full overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[500px]">
        <div className="md:col-span-5 bg-gradient-to-b from-[#0F3B8C] to-[#0d1e3d] p-8 flex flex-col justify-between relative border-r border-zinc-900 text-center overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-center justify-center gap-2">
            <img src="/logo.png" alt="San Pedro Cathedral Logo" className="w-5 h-5 object-contain" />
            <span className="text-[10px] font-black uppercase tracking-widest text-white dark:text-white">San Pedro Cathedral</span>
          </div>

          <div className="w-full max-w-[210px] mx-auto aspect-square bg-white rounded-full p-4 relative flex flex-col justify-center items-center shadow-2xl border-4 border-amber-400">
            <img src="/logo.png" alt="San Pedro Cathedral Logo" className="w-full h-full object-contain" />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-400">Archdiocese of Davao</p>
            <p className="text-[9px] text-zinc-500 dark:text-zinc-400">Official scheduling gatekeeper interface</p>
          </div>
        </div>

        <div className="md:col-span-7 p-8 sm:p-12 flex flex-col justify-center bg-white dark:bg-zinc-950/60">
          <div className="max-w-sm w-full mx-auto space-y-6 text-left">
            <div>
              <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100">Welcome to San Pedro Cathedral Portal</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Please sign in with your parish credentials to continue.</p>
            </div>

            {error ? (
              <p className="p-3.5 bg-red-950/40 border border-red-500/20 rounded-xl text-red-400 text-xs font-semibold" role="alert">
                {error}
              </p>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-1">
                  Email or Username
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center">
                    <Mail className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  </div>
                  <input
                    id="email"
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={254}
                    className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-12 pr-4 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C]"
                    placeholder="you@email.com"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="password" className="block text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Password
                  </label>
                  <button type="button" className="text-[11px] text-[#00A859] hover:text-[#009950] dark:hover:text-[#00bf65] hover:underline font-bold transition-colors duration-150">
                    Forgot?
                  </button>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center">
                    <Lock className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    maxLength={256}
                    className="w-full bg-zinc-50 dark:bg-[#18181b] border border-zinc-200 dark:border-zinc-800 rounded-xl pl-12 pr-10 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-[#0F3B8C]"
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors duration-150"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0F3B8C] text-white hover:bg-[#0d3380] hover:text-white dark:hover:bg-[#1a4fab] dark:hover:text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isLoading ? "Verifying parish credentials..." : "Continue to Portal"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
