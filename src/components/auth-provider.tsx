"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  clearAllOfflineCaches,
  readOfflineCache,
  setOfflineTenantScope,
  writeOfflineCache,
} from "@/lib/offline-cache";
import { notifyOfflineQueueScopeChanged } from "@/lib/offline-queue";

interface User {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "ADMIN" | "AGENT";
}

interface Tenant {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  logoUrl?: string | null;
  waveNumber?: string | null;
  omNumber?: string | null;
  brandPrimaryColor?: string | null;
  brandAccentColor?: string | null;
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  isImpersonated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
  exitImpersonation: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_CACHE_KEY = "auth:me";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isImpersonated, setIsImpersonated] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", {
        cache: "no-store",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setOfflineTenantScope(data.tenant?.id ?? null);
        notifyOfflineQueueScopeChanged();
        setUser(data.user);
        setTenant(data.tenant);
        setIsImpersonated(Boolean(data.isImpersonated));
        writeOfflineCache(AUTH_CACHE_KEY, {
          user: data.user,
          tenant: data.tenant,
          isImpersonated: Boolean(data.isImpersonated),
        });
      } else if (res.status === 401) {
        setUser(null);
        setTenant(null);
        setIsImpersonated(false);
        clearAllOfflineCaches();
        notifyOfflineQueueScopeChanged();
      } else {
        const cached = readOfflineCache<{
          user: User | null;
          tenant: Tenant | null;
          isImpersonated?: boolean;
        }>(AUTH_CACHE_KEY);
        setOfflineTenantScope(cached?.data.tenant?.id ?? null);
        notifyOfflineQueueScopeChanged();
        setUser(cached?.data.user ?? null);
        setTenant(cached?.data.tenant ?? null);
        setIsImpersonated(Boolean(cached?.data.isImpersonated));
      }
    } catch {
      const cached = readOfflineCache<{ user: User | null; tenant: Tenant | null }>(AUTH_CACHE_KEY);
      setOfflineTenantScope(cached?.data.tenant?.id ?? null);
      notifyOfflineQueueScopeChanged();
      setUser(cached?.data.user ?? null);
      setTenant(cached?.data.tenant ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchMe();
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur de connexion");
    setOfflineTenantScope(data.tenant?.id ?? null);
    notifyOfflineQueueScopeChanged();
    setUser(data.user);
    setTenant(data.tenant);
    setIsImpersonated(false);
    writeOfflineCache(AUTH_CACHE_KEY, { user: data.user, tenant: data.tenant, isImpersonated: false });
    router.push("/dashboard");
  };

  const register = async (formData: Record<string, string>) => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(formData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erreur d'inscription");
    setOfflineTenantScope(data.tenant?.id ?? null);
    notifyOfflineQueueScopeChanged();
    setUser(data.user);
    setTenant(data.tenant);
    setIsImpersonated(false);
    writeOfflineCache(AUTH_CACHE_KEY, { user: data.user, tenant: data.tenant, isImpersonated: false });
    router.push("/dashboard");
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    } finally {
      setUser(null);
      setTenant(null);
      setIsImpersonated(false);
      clearAllOfflineCaches();
      notifyOfflineQueueScopeChanged();
      router.push("/login");
    }
  };

  const exitImpersonation = async () => {
    try {
      const res = await fetch("/api/admin/impersonate/exit", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (res.ok) {
        clearAllOfflineCaches();
        notifyOfflineQueueScopeChanged();
        window.location.href = "/admin";
      }
    } catch (err) {
      console.error("Failed to exit impersonation:", err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        loading,
        isImpersonated,
        login,
        register,
        logout,
        exitImpersonation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
