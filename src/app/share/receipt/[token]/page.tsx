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
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  X,
  PhoneCall,
} from "lucide-react";

type ShareMeta = {
  orderCode: string;
  tenantName: string;
  tenantPhone?: string | null;
  tenantWaveNumber?: string | null;
  tenantOmNumber?: string | null;
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

  // Wave payment state
  const [waveLoading, setWaveLoading] = useState(false);
  const [waveError, setWaveError] = useState("");
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState("");
  const [directWaveModal, setDirectWaveModal] = useState<{
    open: boolean;
    phone: string;
    amount: number;
    copied: boolean;
  }>({
    open: false,
    phone: "",
    amount: 0,
    copied: false,
  });

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

  // Handle return from Wave / CinetPay
  useEffect(() => {
    loadMeta();

    const paymentParam = searchParams.get("payment");
    const txParam = searchParams.get("tx");
    const providerParam = searchParams.get("provider");

    if (paymentParam === "return" || txParam) {
      // Vérification du statut (Wave prioritaire ou CinetPay)
      const checkUrl = providerParam === "wave"
        ? `/api/public/receipt/${token}/wave/status?tx=${encodeURIComponent(txParam || "")}`
        : txParam
        ? `/api/public/receipt/${token}/cinetpay/status?tx=${encodeURIComponent(txParam)}`
        : `/api/public/receipt/${token}?meta=1`;

      fetch(checkUrl, { cache: "no-store" })
        .then((res) => res.json())
        .then((data) => {
          if (data?.status === "ACCEPTED" || data?.data?.status === "ACCEPTED" || data?.data?.paymentStatus === "PAYE") {
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

  // Launch Wave Checkout (Production Direct)
  const handleWaveCheckout = async () => {
    if (!meta || meta.amountDue <= 0) return;
    setWaveLoading(true);
    setWaveError("");

    try {
      const res = await fetch(`/api/public/receipt/${token}/wave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: meta.amountDue }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Impossible d'initier le paiement Wave.");
      }

      // Redirection immédiate vers le guichet Wave (App Mobile Wave ou Wave Web)
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      // Si le pressing a configuré son numéro Wave direct
      if (data?.directWaveNumber || meta.tenantWaveNumber || meta.tenantPhone) {
        const phone = (data?.directWaveNumber || meta.tenantWaveNumber || meta.tenantPhone || "").replace(/[^0-9]/g, "");
        setDirectWaveModal({
          open: true,
          phone,
          amount: data?.amount || meta.amountDue,
          copied: false,
        });
        return;
      }

      throw new Error("Moyen de paiement Wave indisponible actuellement.");
    } catch (e) {
      setWaveError(e instanceof Error ? e.message : "Erreur lors de l'accès au guichet Wave");
    } finally {
      setWaveLoading(false);
    }
  };

  const copyWaveNumber = () => {
    if (!directWaveModal.phone) return;
    navigator.clipboard.writeText(directWaveModal.phone);
    setDirectWaveModal((prev) => ({ ...prev, copied: true }));
    setTimeout(() => {
      setDirectWaveModal((prev) => ({ ...prev, copied: false }));
    }, 2500);
  };

  const notifyPressingWhatsApp = () => {
    if (!meta) return;
    const targetPhone = (meta.tenantPhone || meta.tenantWaveNumber || "").replace(/[^0-9]/g, "");
    const msg = `Bonjour ${meta.tenantName}, je viens d'effectuer un paiement Wave de ${formatFCFA(directWaveModal.amount || meta.amountDue)} pour ma commande ${meta.orderCode}. Pouvez-vous valider mon reçu svp ?`;
    const url = targetPhone ? `https://wa.me/221${targetPhone.replace(/^221/, "")}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const activeWavePhone = meta?.tenantWaveNumber || meta?.tenantPhone || "";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-sky-950 px-4 py-10 flex items-center justify-center">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/95 backdrop-blur-xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-[#1DA1F2]/10 p-2.5 text-[#1DA1F2] ring-1 ring-[#1DA1F2]/20">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">{meta ? meta.tenantName : "PressiPro"}</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Reçu certifié & paiement sécurisé
              </p>
            </div>
          </div>
        </div>

        {paymentSuccessMsg && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-3 animate-fade-in shadow-sm">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="font-medium text-xs leading-relaxed">{paymentSuccessMsg}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-slate-50 p-6 text-sm font-medium text-slate-600">
            <LoaderCircle className="h-5 w-5 animate-spin text-[#1DA1F2]" /> Chargement sécurisé du reçu...
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

            {/* WAVE DIRECT PAYMENT SECTION (IF UNPAID) */}
            {meta.amountDue > 0 && (
              <div className="rounded-3xl border-2 border-[#1DA1F2]/30 bg-gradient-to-br from-sky-50/90 via-white to-blue-50/60 p-5 shadow-xl shadow-[#1DA1F2]/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-[#1DA1F2] to-[#0c85d0] text-white flex items-center justify-center shadow-md shadow-[#1DA1F2]/30">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        Paiement direct Wave
                        <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                      </h2>
                      <p className="text-[11px] text-slate-500 font-medium">Ouverture directe de l'application Wave</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-[#1DA1F2]/10 px-2.5 py-1 rounded-xl border border-[#1DA1F2]/20 text-[10px] font-bold text-[#0c85d0]">
                    <span className="w-2 h-2 rounded-full bg-[#1DA1F2] animate-pulse"></span>
                    Instantané
                  </div>
                </div>

                {waveError && (
                  <div className="rounded-xl bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                    <span>{waveError}</span>
                  </div>
                )}

                {/* Primary Action Button: Wave Checkout */}
                <button
                  type="button"
                  onClick={handleWaveCheckout}
                  disabled={waveLoading}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#1DA1F2] via-[#0c85d0] to-[#0070ba] hover:from-[#1a8cd8] hover:to-[#005a96] text-white font-extrabold py-4 px-4 text-sm shadow-xl shadow-[#1DA1F2]/30 hover:shadow-[#1DA1F2]/45 transition-all duration-200 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {waveLoading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Connexion à Wave en cours...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 fill-white" />
                      Payer {formatFCFA(meta.amountDue)} avec Wave
                      <ArrowRight className="h-4 w-4 ml-0.5" />
                    </>
                  )}
                </button>

                {activeWavePhone && (
                  <div className="p-3 rounded-2xl bg-white/80 border border-slate-200/70 flex items-center justify-between text-xs">
                    {activeWavePhone.startsWith("http") || activeWavePhone.includes("pay.wave.com") ? (
                      <>
                        <span className="text-slate-500 text-[11px]">Compte marchand Wave :</span>
                        <span className="font-semibold text-[#0c85d0] bg-[#1DA1F2]/10 px-2 py-0.5 rounded-lg text-[11px]">
                          Lien direct certifié
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-slate-500 text-[11px]">Numéro Wave du pressing :</span>
                        <span className="font-mono font-bold text-slate-800">{activeWavePhone}</span>
                      </>
                    )}
                  </div>
                )}

                <p className="text-[10px] text-center text-slate-400">
                  Paiement certifié Wave Sénégal & UEMOA • 0 frais supplémentaire
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

      {/* MODAL ENVOI DIRECT WAVE */}
      {directWaveModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#1DA1F2]/10 text-[#1DA1F2]">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-sm text-slate-900">Paiement Wave Direct</h3>
              </div>
              <button
                onClick={() => setDirectWaveModal((prev) => ({ ...prev, open: false }))}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Ouvrez votre application Wave et envoyez{" "}
              <strong className="text-slate-900">{formatFCFA(directWaveModal.amount)}</strong> au numéro suivant :
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Numéro Wave Pressing</span>
                <span className="text-base font-mono font-black text-slate-900">{directWaveModal.phone}</span>
              </div>
              <button
                onClick={copyWaveNumber}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 flex items-center gap-1 shadow-2xs hover:bg-slate-50"
              >
                {directWaveModal.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-600">Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href={`https://wave.com/send?phone=+221${directWaveModal.phone.replace(/^221/, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#1DA1F2] hover:bg-[#0c85d0] text-white font-bold text-xs shadow-lg shadow-[#1DA1F2]/25 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Ouvrir l'application Wave
              </a>

              <button
                onClick={notifyPressingWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                Confirmer mon paiement sur WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
