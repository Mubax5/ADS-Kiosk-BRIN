import type { CmsUser } from "@ads-kiosk/shared";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient, apiRequest } from "../api/client";

type AuthPayload = { user: CmsUser; csrfToken: string };
type AuthContextValue = {
  user: CmsUser | null;
  csrfToken: string | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CmsUser | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    apiClient.get<AuthPayload>("/api/v1/auth/me")
      .then((payload) => {
        if (cancelled) return;
        setUser(payload.user);
        setCsrfToken(payload.csrfToken);
      })
      .catch(() => {
        if (cancelled) return;
        setUser(null);
        setCsrfToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    csrfToken,
    loading,
    async login(username, password) {
      const payload = await apiRequest<AuthPayload>("/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      setUser(payload.user);
      setCsrfToken(payload.csrfToken);
    },
    async logout() {
      await apiRequest<null>("/api/v1/auth/logout", { method: "POST" }, csrfToken);
      setUser(null);
      setCsrfToken(null);
    },
  }), [csrfToken, loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
