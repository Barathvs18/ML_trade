import axios from "axios";

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url ?? "";
    const isSessionProbe = requestUrl.includes("/auth/me");
    if (error.response?.status === 401 && !isSessionProbe && window.location.pathname !== "/login") {
      const intended = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      window.location.assign(`/login?returnTo=${encodeURIComponent(intended)}`);
    }
    return Promise.reject(error);
  },
);

export function googleLoginUrl() {
  return `${API_BASE_URL}/auth/google/login`;
}

export default api;
