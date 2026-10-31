import axios from "axios";

export const API_BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/+$/, "");
export const isMockMode = import.meta.env.VITE_USE_MOCK === "true";

const http = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

http.interceptors.response.use(
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

const api = {
  async get(url, config) {
    if (isMockMode) {
      const { mockRequest } = await import("./mock/server");
      return { data: await mockRequest("GET", url, config) };
    }
    return http.get(url, config);
  },
  async post(url, data, config) {
    if (isMockMode) {
      const { mockRequest } = await import("./mock/server");
      return { data: await mockRequest("POST", url, data, config) };
    }
    return http.post(url, data, config);
  },
};

export function googleLoginUrl() {
  return `${API_BASE_URL}/auth/google/login`;
}

export default api;
