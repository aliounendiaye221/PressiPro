"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileText, AlertTriangle, LoaderCircle } from "lucide-react";

type ShareMeta = {
  orderCode: string;
  tenantName: string;
  customerName: string;
  paymentStatus: "PAYE" | "PARTIEL" | "IMPAYE";
  amountDue: number;
};

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

export default function ReceiptSharePage() {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const autoTriggeredRef = useRef(false);

  const downloadUrl = useMemo(() => `/api/public/receipt/${token}?download=1`, [token]);
  const inlineUrl = useMemo(() => `/api/public/receipt/${token}`, [token]);

  const triggerDownload = () => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "recu.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/public/receipt/${token}?meta=1`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Impossible d'ouvrir le reçu");
        }
        if (cancelled) return;

        setMeta(data);

        if (!autoTriggeredRef.current) {
          autoTriggeredRef.current = true;
          setTimeout(() => {
            triggerDownload();
          }, 250);
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Lien de reçu invalide ou expiré");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadMeta();

    return () => {
      cancelled = true;
    };
  }, [token, downloadUrl]);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white px-4 py-10">
      <div className="mx-auto w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{meta ? `Recu ${meta.tenantName}` : "Recu"}</h1>
            <p className="text-sm text-slate-500">Accès client sécurisé</p>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Chargement du reçu...
          </div>
        )}

        {!!error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" /> Erreur</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {meta && !error && (
          <div className="space-y-4">
            <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <p><span className="font-semibold">Commande:</span> {meta.orderCode}</p>
              <p><span className="font-semibold">Pressing:</span> {meta.tenantName}</p>
              <p><span className="font-semibold">Client:</span> {meta.customerName}</p>
              {meta.amountDue > 0 ? (
                <p className="mt-2 font-semibold text-amber-700">Reste à payer: {formatFCFA(meta.amountDue)}</p>
              ) : (
                <p className="mt-2 font-semibold text-emerald-700">Commande soldée</p>
              )}
            </div>

            <a
              href={downloadUrl}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <Download className="h-4 w-4" /> Télécharger le reçu
            </a>

            <a
              href={inlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <FileText className="h-4 w-4" /> Ouvrir le reçu
            </a>
          </div>
        )}
      </div>
    </main>
  );
}
