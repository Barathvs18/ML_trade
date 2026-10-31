import { useCallback, useEffect, useMemo, useState } from "react";
import api, { googleLoginUrl, isMockMode } from "../api/client";
import AuthContext from "./AuthContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api.get("/auth/me")
      .then(({ data }) => { if (active) setUser(data); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } finally {
      setUser(null);
    }
  }, []);

  const login = useCallback(async () => {
    if (isMockMode) {
      const { loginMockUser } = await import("../api/mock/state");
      const mockUser = loginMockUser();
      setUser(mockUser);
      return mockUser;
    }
    window.location.assign(googleLoginUrl());
    return null;
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
