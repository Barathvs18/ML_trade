import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/client";
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

  const value = useMemo(() => ({ user, loading, logout }), [user, loading, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
