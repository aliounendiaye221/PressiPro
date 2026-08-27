"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Download, FileText, AlertTriangle, LoaderCircle, Printer, MessageCircle, CheckCircle2, ShieldCheck } from "lucide-react";

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

  const triggerDownload = useCallback(() => {
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = "recu.pdf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [downloadUrl]);

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
  }, [token, triggerDownload]);

  const shareOnWhatsApp = () => {
    if (!meta) return;
    const text = `Bonjour, voici le reçu de ma commande ${meta.orderCode} chez ${meta.tenantName} : ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 px-4 py-10 flex items-center justify-center">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-600 ring-1 ring-emerald-500/20">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{meta ? meta.tenantName : "PressiPro"}</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Reçu numérique certifié</p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-slate-50 p-6 text-sm font-medium text-slate-600">
            <LoaderCircle className="h-5 w-5 animate-spin text-emerald-600" /> Chargement sécurisé du reçu...
          </div>
        )}

        {!!error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4 text-red-600" /> Lien invalide</p>
            <p className="mt-1 text-xs text-red-600">{error}</p>
          </div>
        )}

        {meta && !error && (
          <div className="space-y-5">
            {/* Status Pill Badge */}
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
              <div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Statut Paiement</span>
                <p className="text-base font-mono font-bold text-slate-800">{meta.orderCode}</p>
              </div>
              <div>
                {meta.paymentStatus === "PAYE" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" /> PAYÉ
                  </span>
                )}
                {meta.paymentStatus === "PARTIEL" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 shadow-sm">
                    PAIEMENT PARTIEL
                  </span>
                )}
                {meta.paymentStatus === "IMPAYE" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200 shadow-sm">
                    NON PAYÉ
                  </span>
                )}
              </div>
            </div>

            {/* Customer & Amounts */}
            <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>Client</span>
                <span className="font-semibold text-slate-900">{meta.customerName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Pressing</span>
                <span className="font-medium text-slate-800">{meta.tenantName}</span>
              </div>
              <div className="border-t border-slate-200/60 pt-2 flex justify-between items-center">
                <span className="font-medium text-slate-700">Reste à payer</span>
                <span className={`text-base font-bold ${meta.amountDue > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                  {meta.amountDue > 0 ? formatFCFA(meta.amountDue) : "0 FCFA (Soldé)"}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5">
              <a
                href={downloadUrl}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 hover:bg-emerald-700 transition-all active:scale-[0.98]"
              >
                <Download className="h-4 w-4" /> Télécharger le Reçu PDF
              </a>

              <a
                href={inlineUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.98]"
              >
                <Printer className="h-4 w-4" /> Consulter / Imprimer
              </a>

              <button
                type="button"
                onClick={shareOnWhatsApp}
                className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-5 py-3.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-500/20 transition-all active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" /> Partager via WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
