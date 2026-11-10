"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex items-center justify-center bg-slate-950 text-white px-4">
        <div className="max-w-md w-full rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center space-y-4 shadow-2xl">
          <h1 className="text-xl font-bold">PressiPro — Rechargement requis</h1>
          <p className="text-sm text-slate-400">
            Une erreur temporaire s&apos;est produite. Cliquez ci-dessous pour relancer l&apos;application en toute sécurité.
          </p>
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 px-5 py-3 text-sm font-bold text-white transition-colors"
          >
            Relancer PressiPro
          </button>
        </div>
      </body>
    </html>
  );
}
