import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { fetchAuthSession, signOut } from "aws-amplify/auth";

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

    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // No authenticated session available; proceed without Authorization header
    // (keep requests unauthenticated)
  }

  return config;
});

// Response interceptor: log details and only redirect when truly unauthenticated
api.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    const status = error.response?.status;

    // Only log unexpected errors loudly; 400s are often user input/DSS validation issues.
    if (!status || status >= 500) {
      console.error("API interceptor caught error:", error);
    }

    if (status === 401) {
      console.error("API error (full):", error);
      console.error("API error response status:", error.response?.status);
      console.error("API error response data:", error.response?.data);
      console.error("API request url:", (error.config as any)?.url);

      const responseData = error.response?.data as { error?: { message?: string } } | undefined;
      const message = responseData?.error?.message?.toLowerCase() ?? "";
      const isTokenFailure = message.includes("invalid token") || message.includes("no token provided");

      if (isTokenFailure) {
        try {
          await signOut();
        } catch (e) {
          console.error("signOut failed:", e);
        }

        if (typeof window !== "undefined") {
          window.location.assign("/");
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
