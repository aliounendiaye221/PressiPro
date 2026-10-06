"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Crown,
  CheckCircle2,
  Zap,
  ShieldCheck,
  CreditCard,
  Sparkles,
  ArrowRight,
  Clock,
  Check,
  AlertTriangle,
  History,
  RefreshCw,
} from "lucide-react";
import {
  SUBSCRIPTION_PLANS,
  PlanKey,
  BillingCycle,
  getPlanPrice,
} from "@/lib/subscription-plans";

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

interface SubscriptionData {
  currentPlanKey: PlanKey;
  subscribedAt: string | null;
  subscriptionExpiresAt: string | null;
  payments: Array<{
    id: string;
    plan: string;
    amount: number;
    transactionId: string;
    paymentMethod: string | null;
    status: string;
    createdAt: string;
  }>;
}

function SubscriptionContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [initiatingPlan, setInitiatingPlan] = useState<PlanKey | null>(null);
  const [actionError, setActionError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const fetchSubscription = useCallback(async () => {
    try {
      const res = await fetch("/api/subscription");
      if (res.ok) {
        const json = await res.json();
        setData(json.data || json);
      }
    } catch {
      // offline or error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSubscription();

    const paymentParam = searchParams.get("payment");
    const txParam = searchParams.get("tx");
    const providerParam = searchParams.get("provider");

    if (paymentParam === "return" && txParam) {
      // Check status of subscription payment (Wave direct ou CinetPay)
      const statusUrl = providerParam === "cinetpay"
        ? `/api/subscription/cinetpay/status?tx=${encodeURIComponent(txParam)}`
        : `/api/subscription/wave/status?tx=${encodeURIComponent(txParam)}`;

      fetch(statusUrl)
        .then((res) => res.json())
        .then((resData) => {
          if (resData?.status === "SUCCESS" || resData?.data?.status === "SUCCESS") {
            setSuccessMsg("Félicitations ! Votre abonnement PressiPro a été activé avec succès.");
            fetchSubscription();
          }
        })
        .catch(() => {
          // ignore
        });
    }
  }, [fetchSubscription, searchParams]);

  const handlePayPlan = async (plan: PlanKey) => {
    if (plan === "FREE") return;
    setInitiatingPlan(plan);
    setActionError("");

    try {
      // Tentative prioritaire via Wave direct checkout
      let res = await fetch("/api/subscription/wave/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, cycle }),
      });

      let resData = await res.json().catch(() => null);

      // Si Wave n'est pas encore configuré mais que CinetPay l'est, fallback transparent
      if (!res.ok && res.status === 500) {
        res = await fetch("/api/subscription/cinetpay/initiate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, cycle }),
        });
        resData = await res.json().catch(() => null);
      }

      if (!res.ok || !resData?.paymentUrl) {
        throw new Error(resData?.error || "Impossible d'initier le paiement de l'abonnement.");
      }

      // Redirection vers le guichet de paiement Wave
      window.location.href = resData.paymentUrl;
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Erreur lors de l'accès au guichet de paiement Wave");
      setInitiatingPlan(null);
    }
  };

  const currentPlanKey = data?.currentPlanKey || "FREE";

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-primary-950 to-slate-900 text-white p-6 sm:p-10 shadow-2xl border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-semibold text-primary-300 backdrop-blur-sm border border-white/10">
              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              Abonnement SaaS PressiPro
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Gérez & renouvelez votre abonnement
            </h1>
            <p className="text-sm text-slate-300 max-w-xl">
              Payez instantanément votre abonnement via <strong>Wave Business (Sénégal & UEMOA)</strong> en 1 clic sur votre téléphone ou via Orange Money et Carte bancaire.
            </p>
          </div>

          {/* Current Plan Badge Card */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-4 sm:p-5 shrink-0 min-w-[240px]">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Plan Actuel
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-white">
                {SUBSCRIPTION_PLANS[currentPlanKey]?.name || currentPlanKey}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIF
              </span>
            </div>
            {data?.subscriptionExpiresAt && (
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                Expire le :{" "}
                <span className="font-semibold text-slate-200">
                  {new Date(data.subscriptionExpiresAt).toLocaleDateString("fr-FR")}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 flex items-center gap-3 animate-fade-in shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="font-semibold text-xs">{successMsg}</p>
        </div>
      )}

      {actionError && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 flex items-center gap-3 animate-fade-in shadow-sm">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <p className="font-semibold text-xs">{actionError}</p>
        </div>
      )}

      {/* Cycle Selector (Mensuel / Annuel) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Choisissez votre formule</h2>
          <p className="text-xs text-gray-500 dark:text-slate-400">Paiement sécurisé et activation immédiate</p>
        </div>

        <div className="flex items-center bg-gray-100 dark:bg-slate-800 p-1.5 rounded-2xl border border-gray-200/80 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              cycle === "monthly"
                ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:text-slate-400"
            }`}
          >
            Facturation Mensuelle
          </button>
          <button
            type="button"
            onClick={() => setCycle("yearly")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              cycle === "yearly"
                ? "bg-primary-600 text-white shadow-sm"
                : "text-gray-500 hover:text-gray-900 dark:text-slate-400"
            }`}
          >
            Facturation Annuelle
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-400 text-amber-950 uppercase tracking-tight">
              2 mois offerts
            </span>
          </button>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-6 w-full">
        {(["BASIC", "PRO"] as PlanKey[]).map((key) => {
          const plan = SUBSCRIPTION_PLANS[key];
          const price = getPlanPrice(key, cycle);
          const isCurrent = currentPlanKey === key;
          const isPopular = plan.popular;
          const isProcessing = initiatingPlan === key;

          return (
            <div
              key={key}
              className={`relative rounded-3xl p-6 sm:p-7 flex flex-col justify-between transition-all duration-300 ${
                isPopular
                  ? "bg-gradient-to-b from-primary-50/80 via-white to-sky-50/40 dark:from-slate-800 dark:to-slate-900 border-2 border-primary-500 shadow-xl shadow-primary-500/10 scale-[1.02]"
                  : "bg-white dark:bg-slate-800/80 border border-gray-200/90 dark:border-slate-700 shadow-md hover:shadow-lg"
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="px-3.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-gradient-to-r from-primary-600 to-sky-600 text-white shadow-md flex items-center gap-1">
                    <Sparkles className="w-3 h-3 fill-white" />
                    {plan.badge || "Recommandé"}
                  </span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold text-lg text-gray-900 dark:text-white">{plan.name}</h3>
                  {isCurrent && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Actuel
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-500 dark:text-slate-400 min-h-[36px] mb-5 leading-relaxed">
                  {plan.description}
                </p>

                {/* Price Display */}
                <div className="mb-6 pb-6 border-b border-gray-100 dark:border-slate-700">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white">
                      {formatFCFA(price)}
                    </span>
                    <span className="text-xs font-semibold text-gray-500 dark:text-slate-400">
                      /{cycle === "yearly" ? "an" : "mois"}
                    </span>
                  </div>
                  {cycle === "yearly" && (
                    <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                      Équivaut à ~{formatFCFA(Math.round(price / 12))} / mois
                    </p>
                  )}
                </div>

                {/* Features List */}
                <div className="space-y-3 mb-8">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block">
                    Inclus dans ce plan :
                  </span>
                  {plan.features.map((feat, i) => (
                    <div key={i} className="flex items-start gap-2.5 text-xs text-gray-700 dark:text-slate-300">
                      <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <div>
                <button
                  type="button"
                  onClick={() => handlePayPlan(key)}
                  disabled={isProcessing}
                  className={`w-full py-3.5 px-4 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg ${
                    isPopular
                      ? "bg-gradient-to-r from-primary-600 via-primary-700 to-sky-700 hover:from-primary-700 hover:to-sky-800 text-white shadow-primary-500/25"
                      : "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-black dark:hover:bg-slate-100 shadow-gray-900/10"
                  } disabled:opacity-60`}
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Connexion Wave en cours...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 fill-current" />
                      {isCurrent ? "Renouveler ce plan" : `Passer à ${plan.name}`}
                      <ArrowRight className="w-4 h-4 ml-0.5" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-2 mt-3 text-[10px] text-gray-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Paiement direct Wave (App Mobile) • Sécurisé</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payment History Section */}
      {data?.payments && data.payments.length > 0 && (
        <div className="card space-y-4">
          <div className="flex items-center gap-2 border-b pb-3 border-gray-100 dark:border-slate-800">
            <History className="w-4 h-4 text-gray-400" />
            <h3 className="font-bold text-sm text-gray-900 dark:text-white">
              Historique de vos paiements d'abonnement
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100 dark:border-slate-800">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Plan</th>
                  <th className="py-2.5 px-3">Montant</th>
                  <th className="py-2.5 px-3">Moyen de paiement</th>
                  <th className="py-2.5 px-3">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-3 text-gray-500 font-mono">
                      {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900 dark:text-white">{p.plan}</td>
                    <td className="py-2.5 px-3 font-bold text-gray-900 dark:text-white">
                      {formatFCFA(p.amount)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-slate-300">
                      {p.paymentMethod || "Wave Business"}
                    </td>
                    <td className="py-2.5 px-3">
                      {p.status === "SUCCESS" ? (
                        <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10">
                          VALIDÉ
                        </span>
                      ) : (
                        <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-600/10">
                          {p.status}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-gray-500">Chargement des abonnements...</div>}>
      <SubscriptionContent />
    </Suspense>
  );
}
