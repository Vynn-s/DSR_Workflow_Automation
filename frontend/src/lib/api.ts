import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { fetchAuthSession, signOut } from "aws-amplify/auth";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  try {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken?.toString();

    if (idToken) {
      config.headers.Authorization = `Bearer ${idToken}`;
    }
  } catch {
    // No authenticated session; continue without attaching a token.
  }

  return config;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      try {
        await signOut();
      } finally {
        if (typeof window !== "undefined") {
          window.location.assign("/login");
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
