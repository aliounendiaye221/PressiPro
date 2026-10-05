"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useAuth } from "./auth-provider";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = "pressipro-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");
  const { tenant } = useAuth();

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      if (stored && ["light", "dark", "system"].includes(stored)) {
        setThemeState(stored);
      } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        setThemeState("system");
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Update HTML class & resolvedTheme
  useEffect(() => {
    const root = document.documentElement;

    const computeResolved = (): "light" | "dark" => {
      if (theme === "system") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      return theme;
    };

    const resolved = computeResolved();
    setResolvedTheme(resolved);

    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      if (theme === "system") {
        const next = mediaQuery.matches ? "dark" : "light";
        setResolvedTheme(next);
        if (next === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  // Apply tenant branding CSS custom properties (Audit item 9)
  useEffect(() => {
    const root = document.documentElement;
    if (tenant?.brandPrimaryColor) {
      root.style.setProperty("--tenant-primary", tenant.brandPrimaryColor);
      root.style.setProperty("--brand-primary", tenant.brandPrimaryColor);
    } else {
      root.style.removeProperty("--tenant-primary");
      root.style.removeProperty("--brand-primary");
    }

    if (tenant?.brandAccentColor) {
      root.style.setProperty("--tenant-accent", tenant.brandAccentColor);
      root.style.setProperty("--brand-accent", tenant.brandAccentColor);
    } else {
      root.style.removeProperty("--tenant-accent");
      root.style.removeProperty("--brand-accent");
    }
  }, [tenant?.brandPrimaryColor, tenant?.brandAccentColor]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
    } catch {
      // Ignore localStorage write errors
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const next: Theme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
