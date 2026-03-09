"use client";

import Link from "next/link";
import { RefreshCw, WifiOff, LayoutDashboard, LogIn } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.3),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.18),_transparent_30%)]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center justify-center">
        <section className="w-full rounded-[2rem] border border-white/10 bg-white/8 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
          <div className="mb-8 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <WifiOff className="h-8 w-8 text-sky-300" />
          </div>

          <div className="max-w-xl space-y-4">
            <p className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-200">
              Mode hors connexion
            </p>
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
              PressiPro reste accessible, meme sans reseau.
            </h1>
            <p className="text-base leading-7 text-slate-200 sm:text-lg">
              Certaines pages deja ouvertes et les ressources principales restent disponibles.
              Reconnectez-vous pour synchroniser les donnees en ligne et acceder aux appels API.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition-transform duration-200 hover:-translate-y-0.5"
            >
              <RefreshCw className="h-4 w-4" />
              Reessayer
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/15"
            >
              <LayoutDashboard className="h-4 w-4" />
              Tableau de bord
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-transparent px-5 py-3 text-sm font-semibold text-slate-200 transition-colors duration-200 hover:bg-white/10"
            >
              <LogIn className="h-4 w-4" />
              Connexion
            </Link>
          </div>

          <div className="mt-8 grid gap-3 text-sm text-slate-300 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="font-semibold text-white">Disponible</p>
              <p className="mt-1">Navigation locale, icones, shell applicatif.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="font-semibold text-white">Limite</p>
              <p className="mt-1">Les appels API et les nouvelles donnees exigent Internet.</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="font-semibold text-white">Conseil</p>
              <p className="mt-1">Installez l'app pour un acces plus rapide depuis le bureau ou l'accueil.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}