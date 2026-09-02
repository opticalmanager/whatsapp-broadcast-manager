"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

export interface BroadcastUser {
  sub: string;
  email: string;
  fullName: string;
  organizationId: string;
  shopId: string | null;
  role: "OWNER" | "ADMIN" | "USER";
}

interface AuthContextValue {
  user: BroadcastUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authMethod: "standalone" | "sso" | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (email: string, password: string, fullName: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  authMethod: null,
  login: async () => ({ success: false }),
  signup: async () => ({ success: false }),
  logout: () => {},
  getAuthHeaders: () => ({}),
});

export function useAuth() {
  return useContext(AuthContext);
}

import { getBackendUrl } from "./backend-url";
export { getBackendUrl } from "./backend-url";




export function AuthProvider({ children, ssoSession }: { children: React.ReactNode; ssoSession?: BroadcastUser | null }) {
  const [user, setUser] = useState<BroadcastUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authMethod, setAuthMethod] = useState<"standalone" | "sso" | null>(null);

  const setAuthCookie = useCallback((jwtToken: string) => {
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `broadcast_auth_token=${encodeURIComponent(jwtToken)}; path=/; expires=${expires}; SameSite=Lax`;
    // Clear any conflicting SSO cookie when standalone auth is set
    document.cookie = "broadcasting_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }, []);

  const clearAllCookies = useCallback(() => {
    document.cookie = "broadcast_auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "broadcasting_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    localStorage.removeItem("broadcast_token");
    localStorage.removeItem("broadcast_session");
  }, []);

  // Resolve authentication on mount
  useEffect(() => {
    async function resolveAuth() {
      const storedToken = typeof window !== "undefined" ? localStorage.getItem("broadcast_token") : null;
      let localSession: BroadcastUser | null = null;

      // Priority 1A: Immediate local session hydration (zero flash, survives server restarts)
      if (storedToken) {
        try {
          const storedSessionStr = localStorage.getItem("broadcast_session");
          if (storedSessionStr) {
            const parsed = JSON.parse(storedSessionStr);
            if (parsed && (parsed.organizationId || parsed.organization_id)) {
              localSession = {
                sub: parsed.sub || parsed.userId || parsed.id || "",
                email: parsed.email || "",
                fullName: parsed.fullName || parsed.full_name || "Store Owner",
                organizationId: parsed.organizationId || parsed.organization_id,
                shopId: parsed.shopId || parsed.shop_id || null,
                role: parsed.role || "OWNER",
              };
            }
          }
        } catch {}

        // Fallback: parse JWT payload directly if session object missing
        if (!localSession) {
          try {
            const parts = storedToken.split(".");
            if (parts.length === 3) {
              const payloadStr = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
              const payload = JSON.parse(payloadStr);
              if (payload && payload.organizationId) {
                localSession = {
                  sub: payload.sub || payload.userId || "",
                  email: payload.email || "",
                  fullName: payload.fullName || "",
                  organizationId: payload.organizationId,
                  shopId: payload.shopId || null,
                  role: payload.role || "OWNER",
                };
              }
            }
          } catch {}
        }

        if (localSession && localSession.organizationId) {
          setUser(localSession);
          setToken(storedToken);
          setAuthMethod("standalone");
          setAuthCookie(storedToken);
          setIsLoading(false);
        }
      }

      // Priority 1B: Background verification with backend (graceful offline handling)
      if (storedToken) {
        try {
          const backendUrl = getBackendUrl();
          const res = await fetch(`${backendUrl}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          });
          if (res.status === 401 || res.status === 403) {
            // Explicit 401: Token was revoked/invalidated by server
            clearAllCookies();
            setUser(null);
            setToken(null);
            setAuthMethod(null);
            setIsLoading(false);
            return;
          } else if (res.ok) {
            const json = await res.json();
            if (json.success && json.session) {
              const verifiedUser: BroadcastUser = {
                sub: json.session.sub,
                email: json.session.email,
                fullName: json.session.fullName,
                organizationId: json.session.organizationId,
                shopId: json.session.shopId || null,
                role: json.session.role || "OWNER",
              };
              setUser(verifiedUser);
              setToken(storedToken);
              setAuthMethod("standalone");
              setAuthCookie(storedToken);
              localStorage.setItem("broadcast_session", JSON.stringify(verifiedUser));
            }
          }
        } catch {
          // Server starting up or network unavailable - keep local authenticated state intact
        }
        setIsLoading(false);
        return;
      }

      // Priority 2: SSO session from server-side cookie (CRM 1-click launch)
      if (ssoSession && ssoSession.organizationId) {
        setUser({
          sub: ssoSession.sub || (ssoSession as any).userId || "",
          email: ssoSession.email || "",
          fullName: ssoSession.fullName || "",
          organizationId: ssoSession.organizationId,
          shopId: ssoSession.shopId || null,
          role: ssoSession.role || "OWNER",
        });
        setToken(JSON.stringify(ssoSession));
        setAuthMethod("sso");
        setIsLoading(false);
        return;
      }

      // No valid session
      setUser(null);
      setToken(null);
      setAuthMethod(null);
      setIsLoading(false);
    }

    resolveAuth();
  }, [ssoSession, setAuthCookie, clearAllCookies]);

  const login = useCallback(async (email: string, password: string) => {
    const backendUrl = getBackendUrl();
    const tryFetch = async () => {
      return await fetch(`${backendUrl}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    };

    try {
      let res: Response;
      try {
        res = await tryFetch();
      } catch {
        // Retry once after 600ms if backend was starting up
        await new Promise((r) => setTimeout(r, 600));
        res = await tryFetch();
      }

      const json = await res.json();

      if (!res.ok) {
        return { success: false, error: json.message || "Invalid email or password." };
      }

      if (json.success && json.token && json.session) {
        localStorage.setItem("broadcast_token", json.token);
        localStorage.setItem("broadcast_session", JSON.stringify(json.session));
        setAuthCookie(json.token);

        setToken(json.token);
        setUser({
          sub: json.session.sub,
          email: json.session.email,
          fullName: json.session.fullName,
          organizationId: json.session.organizationId,
          shopId: json.session.shopId || null,
          role: json.session.role || "OWNER",
        });
        setAuthMethod("standalone");

        return { success: true };
      }

      return { success: false, error: "Unexpected response from server." };
    } catch (err: any) {
      return { 
        success: false, 
        error: "Backend server unreachable (port 4000). Please ensure the backend server is running." 
      };
    }
  }, [setAuthCookie]);

  const signup = useCallback(async (email: string, password: string, fullName: string) => {
    try {
      const backendUrl = getBackendUrl();
      const res = await fetch(`${backendUrl}/api/v1/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, fullName }),
      });


      const json = await res.json();

      if (!res.ok) {
        return { success: false, error: json.message || "Registration failed." };
      }

      if (json.success && json.token && json.session) {
        localStorage.setItem("broadcast_token", json.token);
        localStorage.setItem("broadcast_session", JSON.stringify(json.session));
        setAuthCookie(json.token);

        setToken(json.token);
        setUser({
          sub: json.session.sub,
          email: json.session.email,
          fullName: json.session.fullName,
          organizationId: json.session.organizationId,
          shopId: json.session.shopId || null,
          role: json.session.role || "OWNER",
        });
        setAuthMethod("standalone");

        return { success: true };
      }

      return { success: false, error: "Unexpected response from server." };
    } catch (err: any) {
      return { success: false, error: err.message || "Network error. Please try again." };
    }
  }, [setAuthCookie]);

  const logout = useCallback(() => {
    clearAllCookies();
    setUser(null);
    setToken(null);
    setAuthMethod(null);
    window.location.href = "/login";
  }, [clearAllCookies]);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (token) return { Authorization: `Bearer ${token}` };
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem("broadcast_token");
      if (storedToken) return { Authorization: `Bearer ${storedToken}` };
      const storedSession = localStorage.getItem("broadcast_session");
      if (storedSession) return { Authorization: `Bearer ${storedSession}` };
    }
    return {};
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!user,
      isLoading,
      authMethod,
      login,
      signup,
      logout,
      getAuthHeaders,
    }),
    [user, token, isLoading, authMethod, login, signup, logout, getAuthHeaders]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
