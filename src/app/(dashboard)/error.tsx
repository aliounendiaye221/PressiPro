"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, LayoutDashboard } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError]", error);
  }, [error]);

  return (
    <div className="py-16 px-4 flex items-center justify-center">
      <div className="max-w-md w-full card bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 text-center space-y-4 p-6 sm:p-8 shadow-lg">
        <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Impossible d&apos;afficher cette section
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
            Vérifiez votre connexion Internet ou cliquez sur « Réessayer » pour recharger la page.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
          <button
            type="button"
            onClick={reset}
            className="btn-primary flex-1 text-xs flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Réessayer</span>
          </button>
          <Link
            href="/dashboard"
            className="btn-secondary flex-1 text-xs flex items-center justify-center gap-1.5"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Accueil</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
