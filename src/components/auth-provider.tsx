"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { readOfflineCache, removeOfflineCache, writeOfflineCache } from "@/lib/offline-cache";

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
}

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: Record<string, string>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const AUTH_CACHE_KEY = "auth:me";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
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
        setUser(data.user);
        setTenant(data.tenant);
        writeOfflineCache(AUTH_CACHE_KEY, { user: data.user, tenant: data.tenant });
      } else if (res.status === 401) {
        setUser(null);
        setTenant(null);
        removeOfflineCache(AUTH_CACHE_KEY);
      } else {
        const cached = readOfflineCache<{ user: User | null; tenant: Tenant | null }>(AUTH_CACHE_KEY);
        setUser(cached?.data.user ?? null);
        setTenant(cached?.data.tenant ?? null);
      }
    } catch {
      const cached = readOfflineCache<{ user: User | null; tenant: Tenant | null }>(AUTH_CACHE_KEY);
      setUser(cached?.data.user ?? null);
      setTenant(cached?.data.tenant ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
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
    setUser(data.user);
    setTenant(data.tenant);
    writeOfflineCache(AUTH_CACHE_KEY, { user: data.user, tenant: data.tenant });
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
    setUser(data.user);
    setTenant(data.tenant);
    writeOfflineCache(AUTH_CACHE_KEY, { user: data.user, tenant: data.tenant });
    router.push("/dashboard");
  };

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
    });
    setUser(null);
    setTenant(null);
    removeOfflineCache(AUTH_CACHE_KEY);
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, tenant, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
