"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950 px-4 py-12">
      <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-3xl border border-gray-200 dark:border-slate-800 shadow-xl p-6 sm:p-8 text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Une erreur inattendue est survenue
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed">
            Vos données de pressing sont intactes. Vous pouvez actualiser cet écran ou revenir à l&apos;accueil.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={reset}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Réessayer</span>
          </button>
          <Link
            href="/dashboard"
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Tableau de bord</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
