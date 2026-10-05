"use client";

import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";
import { triggerHaptic } from "@/lib/feedback";

export function ThemeToggle({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const handleToggle = () => {
    triggerHaptic("light");
    toggleTheme();
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isDark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={isDark ? "Mode clair" : "Mode sombre"}
      className={`inline-flex items-center gap-2 rounded-xl p-2 text-sm font-medium transition-colors ${
        isDark
          ? "bg-slate-800 text-amber-300 hover:bg-slate-700 hover:text-amber-200"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
      } ${className}`}
    >
      {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
      {showLabel && (
        <span className="text-xs">{isDark ? "Mode clair" : "Mode sombre"}</span>
      )}
    </button>
  );
}
