import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { fetchAuthSession, signOut } from "aws-amplify/auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
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
    // Always log the error for debugging
    console.error("API interceptor caught error:", error);

    if (error.response?.status === 401) {
      try {
        // Check current session to determine whether user is still authenticated
        const session = await fetchAuthSession();
        const token = session.tokens?.idToken?.toString();

        console.error("API error (full):", error);
        console.error("API error response status:", error.response?.status);
        console.error("API error response data:", error.response?.data);
        console.error("API request url:", (error.config as any)?.url);

        // If there's no token, the user is unauthenticated: sign out and redirect
        if (!token) {
          try {
            await signOut();
          } catch (e) {
            console.error("signOut failed:", e);
          }

          if (typeof window !== "undefined") {
            window.location.assign("/");
          }
        } else {
          // Authenticated but received 401 - do not redirect automatically.
          // This may indicate insufficient permissions or an expired/invalid token.
        }
      } catch (sessionErr) {
        // Could not retrieve session: treat as unauthenticated
        console.error("Failed to fetch session during 401 handling:", sessionErr);
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
