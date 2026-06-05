import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { fetchAuthSession, signOut } from "aws-amplify/auth";

if (import.meta.env.DEV && !import.meta.env.VITE_API_URL) {
  console.warn("VITE_API_URL is not defined");
}

function readCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  return document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? null;
}

async function clearSessionAndRedirect() {
  try {
    await signOut({ global: true });
  } catch {
    // Ignore sign-out failures; redirect still blocks stale sessions.
  }

  if (typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.assign("/login");
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
    "Ngrok-Skip-Browser-Warning": "true",
  },
});

// Attach Cognito idToken as Bearer when available (Amplify v6 syntax)
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken?.toString();
    const expiresAt = session.tokens?.idToken?.payload.exp;

    if (typeof expiresAt === "number" && expiresAt * 1000 <= Date.now()) {
      await clearSessionAndRedirect();
      return config;
    }

    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch {
    // No authenticated session available; proceed without Authorization header
    // (keep requests unauthenticated)
  }

  if (config.method && config.method.toUpperCase() !== "GET") {
    config.headers = config.headers ?? {};
    (config.headers as any)["Content-Type"] = "application/json";

    const csrfToken = readCookie("csrfToken") ?? readCookie("XSRF-TOKEN");
    if (csrfToken) {
      (config.headers as any)["X-CSRF-Token"] = decodeURIComponent(csrfToken);
    }
  }

  return config;
});

// Response interceptor: redirect stale sessions without logging sensitive payloads.
api.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const status = error.response?.status;

    if (status === 401) {
      await clearSessionAndRedirect();
    } else if (import.meta.env.DEV && (!status || status >= 500)) {
      console.warn("API request failed");
    }

    return Promise.reject(error);
  },
);

export default api;
