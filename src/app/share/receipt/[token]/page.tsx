"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Download,
  FileText,
  AlertTriangle,
  LoaderCircle,
  Printer,
  MessageCircle,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Zap,
  ArrowRight,
  Sparkles,
} from "lucide-react";

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
  const searchParams = useSearchParams();
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const autoTriggeredRef = useRef(false);

  // CinetPay payment state
  const [cinetLoading, setCinetLoading] = useState(false);
  const [cinetError, setCinetError] = useState("");
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState("");

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

  const loadMeta = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/public/receipt/${token}?meta=1`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Impossible d'ouvrir le reçu");
      }

      setMeta(data);

      if (!autoTriggeredRef.current && !isRefresh) {
        autoTriggeredRef.current = true;
        setTimeout(() => {
          triggerDownload();
        }, 250);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lien de reçu invalide ou expiré");
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [token, triggerDownload]);

  // Handle return from CinetPay
  useEffect(() => {
    loadMeta();

    const paymentParam = searchParams.get("payment");
    const txParam = searchParams.get("tx");

    if (paymentParam === "return" || txParam) {
      // Check payment status from CinetPay API
      const checkUrl = txParam
        ? `/api/public/receipt/${token}/cinetpay/status?tx=${encodeURIComponent(txParam)}`
        : `/api/public/receipt/${token}?meta=1`;

      fetch(checkUrl, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data?.status === "ACCEPTED" || data?.data?.paymentStatus === "PAYE") {
            setPaymentSuccessMsg("Paiement validé avec succès ! Votre reçu a été mis à jour.");
            loadMeta(true);
          }
        })
        .catch(() => {
          // ignore
        });
    }
  }, [loadMeta, searchParams, token]);

  const shareOnWhatsApp = () => {
    if (!meta) return;
    const text = `Bonjour, voici le reçu de ma commande ${meta.orderCode} chez ${meta.tenantName} : ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  // Launch CinetPay Checkout
  const handleCinetPayCheckout = async () => {
    if (!meta || meta.amountDue <= 0) return;
    setCinetLoading(true);
    setCinetError("");

    try {
      const res = await fetch(`/api/public/receipt/${token}/cinetpay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: meta.amountDue }),
      });

      const data = await res.json();

      if (!res.ok || !data?.paymentUrl) {
        throw new Error(data?.error || "Impossible d'initier le paiement en ligne.");
      }

      // Redirection vers le guichet sécurisé CinetPay (Wave, OM, Free, CB)
      window.location.href = data.paymentUrl;
    } catch (e) {
      setCinetError(e instanceof Error ? e.message : "Erreur lors de l'ouverture du paiement");
      setCinetLoading(false);
    }
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
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Reçu numérique certifié
              </p>
            </div>
          </div>
        </div>

        {paymentSuccessMsg && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-3 animate-fade-in">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="font-medium text-xs leading-relaxed">{paymentSuccessMsg}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-slate-50 p-6 text-sm font-medium text-slate-600">
            <LoaderCircle className="h-5 w-5 animate-spin text-emerald-600" /> Chargement sécurisé du reçu...
          </div>
        )}

        {!!error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="flex items-center gap-2 font-semibold">
              <AlertTriangle className="h-4 w-4 text-red-600" /> Lien invalide
            </p>
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
                <span
                  className={`text-base font-bold ${
                    meta.amountDue > 0 ? "text-amber-600" : "text-emerald-600"
                  }`}
                >
                  {meta.amountDue > 0 ? formatFCFA(meta.amountDue) : "0 FCFA (Soldé)"}
                </span>
              </div>
            </div>

            {/* CINETPAY ONLINE PAYMENT SECTION (IF UNPAID) */}
            {meta.amountDue > 0 && (
              <div className="rounded-2xl border-2 border-primary-200/90 bg-gradient-to-br from-primary-50/70 via-white to-sky-50/50 p-5 shadow-lg shadow-primary-500/5 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-md shadow-primary-600/30">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                        Paiement en ligne sécurisé
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      </h2>
                      <p className="text-[11px] text-gray-500">Réglez instantanément avec CinetPay</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-gray-200/70 text-[10px] font-semibold text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Direct
                  </div>
                </div>

                {/* Available Payment Methods Badges */}
                <div className="flex flex-wrap items-center gap-1.5 py-1">
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#1DA1F2]/10 text-[#0c85d0] border border-[#1DA1F2]/20">
                    Wave
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-[#FF7900]/10 text-[#e06b00] border border-[#FF7900]/20">
                    Orange Money
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-50 text-red-600 border border-red-200/60">
                    Free Money
                  </span>
                  <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200/60">
                    Carte bancaire
                  </span>
                </div>

                {cinetError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{cinetError}</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCinetPayCheckout}
                  disabled={cinetLoading}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-primary-600 via-primary-700 to-sky-700 hover:from-primary-700 hover:to-sky-800 text-white font-bold py-3.5 px-4 text-sm shadow-xl shadow-primary-600/30 hover:shadow-primary-600/40 transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {cinetLoading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Redirection vers le paiement...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 fill-white" />
                      Payer {formatFCFA(meta.amountDue)} maintenant
                      <ArrowRight className="h-4 w-4 ml-0.5" />
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-gray-400">
                  Transactions cryptées et sécurisées par CinetPay • Aucun frais caché
                </p>
              </div>
            )}

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
