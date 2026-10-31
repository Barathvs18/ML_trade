import { useCallback, useEffect, useMemo, useState } from "react";
import { googleLoginUrl, isMockMode } from "../api/client";
import { getCurrentUser, logout as logoutRequest } from "../api/auth";
import AuthContext from "./AuthContext";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getCurrentUser()
      .then((data) => { if (active) setUser(data); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
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
