"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Smartphone,
  CreditCard,
  ArrowLeft,
  Loader2,
  AlertCircle,
  HelpCircle,
  Building2,
  Sparkles,
} from "lucide-react";

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
}

function SimulateCheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const transactionId = searchParams.get("tx") || "SUB-TEST-0001";
  const amountStr = searchParams.get("amount") || "15000";
  const amount = parseInt(amountStr, 10) || 15000;
  const description = searchParams.get("desc") || "Paiement PressiPro";
  const returnUrl = searchParams.get("returnUrl") || "/subscription";
  const notifyUrl = searchParams.get("notifyUrl") || "";
  const customerName = searchParams.get("customerName") || "Gérant";
  const customerPhone = searchParams.get("customerPhone") || "+221770000000";

  const [selectedMethod, setSelectedMethod] = useState<"WAVE" | "OM" | "FREE" | "CARD">("WAVE");
  const [phoneNumber, setPhoneNumber] = useState(customerPhone);
  const [processing, setProcessing] = useState(false);
  const [resultState, setResultState] = useState<"idle" | "success" | "refused">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSimulatePayment = async (status: "ACCEPTED" | "REFUSED") => {
    setProcessing(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/cinetpay/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId,
          amount,
          method: selectedMethod,
          status,
          notifyUrl,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Erreur lors du traitement de la simulation.");
      }

      setResultState(status === "ACCEPTED" ? "success" : "refused");

      // Redirection après 1.5s pour apprécier le statut visuel
      setTimeout(() => {
        if (returnUrl) {
          window.location.href = returnUrl;
        } else {
          router.push("/subscription");
        }
      }, 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erreur inattendue");
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-lg">
        {/* En-tête guichet */}
        <div className="text-center mb-6 space-y-2">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Environnement Bac à sable (Sandbox / Simulation)
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center justify-center gap-2">
            <Building2 className="w-6 h-6 text-primary-400" />
            Guichet Sécurisé PressiPro
          </h1>
          <p className="text-xs text-slate-400">
            Simulateur de validation CinetPay (Wave, Orange Money, Carte)
          </p>
        </div>

        {/* Card principale */}
        <div className="bg-slate-900/90 border border-slate-700/80 rounded-3xl shadow-2xl p-6 sm:p-8 backdrop-blur-xl space-y-6">
          {/* Récapitulatif montant */}
          <div className="bg-slate-800/80 rounded-2xl p-5 border border-slate-700/60 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Total à régler
              </span>
              <p className="text-xs text-slate-300 line-clamp-1">{description}</p>
              <p className="text-[10px] text-slate-500 font-mono">Réf : {transactionId}</p>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                {formatFCFA(amount)}
              </span>
            </div>
          </div>

          {resultState === "idle" ? (
            <>
              {/* Choix du moyen de paiement */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                  Sélectionnez le moyen de paiement de test
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {/* WAVE */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("WAVE")}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      selectedMethod === "WAVE"
                        ? "bg-sky-500/20 border-sky-400 text-sky-200 ring-2 ring-sky-500/30"
                        : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-extrabold text-sm">Wave</span>
                      <Smartphone className="w-4 h-4 text-sky-400" />
                    </div>
                    <span className="text-[10px] text-slate-400">Sénégal / CI (Sans frais)</span>
                  </button>

                  {/* ORANGE MONEY */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("OM")}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      selectedMethod === "OM"
                        ? "bg-orange-500/20 border-orange-400 text-orange-200 ring-2 ring-orange-500/30"
                        : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-extrabold text-sm">Orange Money</span>
                      <Smartphone className="w-4 h-4 text-orange-400" />
                    </div>
                    <span className="text-[10px] text-slate-400">SN / CI / ML (Mobile)</span>
                  </button>

                  {/* FREE MONEY */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("FREE")}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      selectedMethod === "FREE"
                        ? "bg-red-500/20 border-red-400 text-red-200 ring-2 ring-red-500/30"
                        : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-extrabold text-sm">Free Money</span>
                      <Smartphone className="w-4 h-4 text-red-400" />
                    </div>
                    <span className="text-[10px] text-slate-400">Sénégal (Mobile)</span>
                  </button>

                  {/* CARTE BANCAIRE */}
                  <button
                    type="button"
                    onClick={() => setSelectedMethod("CARD")}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      selectedMethod === "CARD"
                        ? "bg-indigo-500/20 border-indigo-400 text-indigo-200 ring-2 ring-indigo-500/30"
                        : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="font-extrabold text-sm">Carte Bancaire</span>
                      <CreditCard className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-[10px] text-slate-400">Visa / Mastercard</span>
                  </button>
                </div>
              </div>

              {/* Champ téléphone simulé */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Numéro de téléphone de test</span>
                  <span className="text-[10px] text-slate-500 font-normal">Format international</span>
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+221770000000"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {errorMessage && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Boutons d'action */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleSimulatePayment("ACCEPTED")}
                  disabled={processing}
                  className="w-full py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-600 text-white shadow-lg shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-50"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Traitement de la transaction...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Valider le paiement de test ({formatFCFA(amount)})
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleSimulatePayment("REFUSED")}
                  disabled={processing}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Simuler un refus / échec de paiement
                </button>
              </div>
            </>
          ) : resultState === "success" ? (
            <div className="py-8 text-center space-y-3 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Paiement validé avec succès !</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                La transaction <span className="font-mono text-emerald-400">{transactionId}</span> a été acceptée. Redirection vers PressiPro en cours...
              </p>
              <div className="pt-2">
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin mx-auto" />
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-3 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 mx-auto flex items-center justify-center">
                <XCircle className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">Paiement refusé</h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                La transaction de test a été marquée comme échouée. Redirection en cours...
              </p>
              <div className="pt-2">
                <Loader2 className="w-5 h-5 text-rose-400 animate-spin mx-auto" />
              </div>
            </div>
          )}

          {/* Note informative */}
          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Mode démonstration : aucun montant réel ne sera prélevé de vos comptes Wave ou Orange Money. Ce simulateur permet de tester le flux complet de souscription SaaS et de validation des commandes.
            </span>
          </div>
        </div>

        {/* Bouton retour */}
        <div className="text-center mt-5">
          <a
            href={returnUrl || "/subscription"}
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retourner à PressiPro sans payer
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SimulateCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400 text-xs">
          Chargement du guichet de paiement...
        </div>
      }
    >
      <SimulateCheckoutContent />
    </Suspense>
  );
}
