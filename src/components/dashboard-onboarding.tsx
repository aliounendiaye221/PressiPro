"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
  Circle,
  ChevronRight,
  X,
  PlusCircle,
  MessageCircle,
  CreditCard,
  Wallet,
  Shirt,
  Lightbulb,
  ChevronDown,
  ArrowRight,
  Minimize2,
  Check,
} from "lucide-react";

interface DashboardOnboardingProps {
  totalOrders: number;
  tenantName?: string;
  hasWaveOrOm?: boolean;
  hasExpenses?: boolean;
}

export function DashboardOnboarding({
  totalOrders,
  tenantName,
  hasWaveOrOm = false,
  hasExpenses = false,
}: DashboardOnboardingProps) {
  // State: "docked" (slim top banner), "drawer" (slide-over modal), or "floating" (compact round assistant pill)
  const [viewState, setViewState] = useState<"docked" | "drawer" | "floating">("floating");
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("pressipro_onboarding_state");
    if (saved === "floating" || saved === "docked" || saved === "dismissed") {
      setViewState(saved === "dismissed" ? "floating" : saved);
    } else {
      // First time: docked slim ribbon
      setViewState("docked");
    }
  }, []);

  const setAndSaveState = (state: "docked" | "drawer" | "floating") => {
    setViewState(state);
    if (state !== "drawer") {
      localStorage.setItem("pressipro_onboarding_state", state);
    }
  };

  const steps = [
    {
      id: "services",
      title: "Tarifs & Services prêts à l'emploi",
      desc: "Boubous, Costumes, Lavage au kilo configurés pour un encaissement ultra-rapide.",
      completed: true,
      link: "/settings",
      actionLabel: "Personnaliser tarifs",
      icon: Shirt,
      tip: "Astuce : Vous pouvez ajouter vos propres catégories (ex: Draps d'hôtel, Rideaux) et choisir la tarification à la pièce ou au kilo.",
    },
    {
      id: "order",
      title: "Enregistrer votre premier dépôt",
      desc: "Saisissez les articles, acompte éventuel et date promise en moins de 30 secondes.",
      completed: totalOrders > 0,
      link: "/orders/new",
      actionLabel: "Nouveau dépôt",
      icon: PlusCircle,
      tip: "Astuce : Un code unique (ex: P-00042) et un QR code sont automatiquement générés sur le reçu imprimé ou envoyé sur WhatsApp.",
    },
    {
      id: "whatsapp",
      title: "Notifier par WhatsApp en 1 clic",
      desc: "Prévenez vos clients dès que le linge est prêt sans devoir enregistrer leur numéro.",
      completed: totalOrders > 0,
      link: "/orders",
      actionLabel: "Voir commandes",
      icon: MessageCircle,
      tip: "Astuce : Sur la commande, le bouton WhatsApp pré-remplit le message avec le nom du client et le montant restant à régler.",
    },
    {
      id: "payment",
      title: "Configurer vos numéros Wave & Orange Money",
      desc: "Affichez vos coordonnées de paiement mobile directement sur les tickets de caisse.",
      completed: hasWaveOrOm,
      link: "/settings",
      actionLabel: "Ajouter Wave / OM",
      icon: CreditCard,
      tip: "Astuce : Les clients peuvent scanner le QR code ou utiliser vos numéros Wave/OM indiqués au bas du reçu.",
    },
    {
      id: "expenses",
      title: "Suivre vos dépenses & rentabilité nette",
      desc: "Notez vos achats de lessive, électricité ou carburant pour connaître votre vrai bénéfice.",
      completed: hasExpenses,
      link: "/expenses",
      actionLabel: "Ajouter une dépense",
      icon: Wallet,
      tip: "Astuce : À la fin du mois, PressiPro calcule automatiquement : Chiffre d'Affaires - Dépenses = Bénéfice Net avec le % de marge.",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const nextIncompleteStep = steps.find((s) => !s.completed);

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. DOCKED SLIM RIBBON (Modern, Unobtrusive, Elegant)
      ────────────────────────────────────────────────────────────── */}
      {viewState === "docked" && (
        <div className="relative overflow-hidden rounded-2xl border border-primary-200/80 bg-gradient-to-r from-primary-50/90 via-white to-white p-3 sm:p-3.5 shadow-xs transition-all animate-fade-in">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Left: Icon & Progress */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm text-gray-900 truncate">
                    Guide de Démarrage PressiPro
                  </span>
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-primary-100 text-primary-800">
                    {completedCount}/{steps.length} étapes ({progressPercent}%)
                  </span>
                </div>
                {nextIncompleteStep ? (
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">
                    Étape conseillée : <strong className="text-gray-800">{nextIncompleteStep.title}</strong>
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                    🎉 Félicitations ! Votre pressing est configuré à 100%.
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setViewState("drawer")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 active:scale-95 shadow-xs transition-all"
              >
                <span>Ouvrir le guide</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setAndSaveState("floating")}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Réduire en widget discret"
                aria-label="Réduire le guide"
              >
                <Minimize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          2. FLOATING ASSISTANT PILL (Discreet Circular Progress)
      ────────────────────────────────────────────────────────────── */}
      {viewState === "floating" && (
        <div className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 animate-fade-in">
          <button
            type="button"
            onClick={() => setViewState("drawer")}
            className="group flex items-center gap-2.5 bg-white/95 backdrop-blur-md border border-primary-200/90 hover:border-primary-400 rounded-full px-3.5 py-2 shadow-lg shadow-primary-500/15 transition-all duration-200 hover:scale-[1.03] active:scale-95"
            aria-label="Ouvrir le guide de démarrage"
          >
            {/* SVG Circular Progress Ring */}
            <div className="relative w-6 h-6 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  className="stroke-gray-200"
                  strokeWidth="3.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  className="stroke-primary-600 transition-all duration-500"
                  strokeWidth="3.5"
                  strokeDasharray="94.2"
                  strokeDashoffset={94.2 - (94.2 * progressPercent) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <Sparkles className="w-3 h-3 text-primary-600 absolute" />
            </div>

            <div className="text-left">
              <span className="text-xs font-bold text-gray-900 group-hover:text-primary-700 transition-colors block leading-tight">
                Guide ({completedCount}/{steps.length})
              </span>
              <span className="text-[10px] text-gray-400 block font-medium">
                {progressPercent}% complété
              </span>
            </div>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. INTERACTIVE ONBOARDING DRAWER (Modern Slide-Over Sheet)
      ────────────────────────────────────────────────────────────── */}
      {viewState === "drawer" && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-900/50 backdrop-blur-xs z-50 transition-opacity animate-fade-in"
            onClick={() => setViewState("floating")}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-200/80 animate-slide-left">
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-100 bg-gradient-to-br from-primary-50/80 to-white">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-gray-900">
                      Guide Rapide {tenantName ? `· ${tenantName}` : ""}
                    </h3>
                    <p className="text-xs text-gray-500 font-medium">
                      Conseils & démarches quotidiennes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAndSaveState("docked")}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-xs font-semibold"
                    title="Ancrer en haut du tableau de bord"
                  >
                    Ancrer
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewState("floating")}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                  <span className="text-gray-700">Progression du pressing</span>
                  <span className="text-primary-700">{completedCount}/{steps.length} validées ({progressPercent}%)</span>
                </div>
                <div className="w-full h-2.5 bg-gray-200/80 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-primary-600 to-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Steps List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isTipOpen = expandedTip === step.id;

                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border transition-all p-3.5 ${
                      step.completed
                        ? "bg-gray-50/60 border-gray-200/70"
                        : "bg-white border-primary-200/80 shadow-xs ring-1 ring-primary-500/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Check / Status Icon */}
                      <div className="mt-0.5 shrink-0">
                        {step.completed ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-primary-500 text-primary-600 flex items-center justify-center font-bold text-xs">
                            {index + 1}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className={`text-sm font-bold truncate ${step.completed ? "text-gray-700 line-through decoration-gray-400" : "text-gray-900"}`}>
                            {step.title}
                          </h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            {step.completed ? "Validé" : "À faire"}
                          </span>
                        </div>

                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                          {step.desc}
                        </p>

                        {/* Action Link & Tip trigger */}
                        <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-gray-100 flex-wrap">
                          <Link
                            href={step.link}
                            onClick={() => setViewState("floating")}
                            className="inline-flex items-center gap-1 text-xs font-bold text-primary-700 hover:text-primary-800 hover:underline"
                          >
                            <span>{step.actionLabel}</span>
                            <ArrowRight className="w-3 h-3" />
                          </Link>

                          <button
                            type="button"
                            onClick={() => setExpandedTip(isTipOpen ? null : step.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 hover:text-primary-600 transition-colors"
                          >
                            <Lightbulb className="w-3 h-3 text-amber-500" />
                            <span>{isTipOpen ? "Masquer conseil" : "Conseil pro"}</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${isTipOpen ? "rotate-180" : ""}`} />
                          </button>
                        </div>

                        {/* Expandable Pro Tip */}
                        {isTipOpen && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80 text-[11px] text-amber-900 leading-relaxed animate-fade-in">
                            {step.tip}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setAndSaveState("floating")}
                className="text-xs text-gray-500 hover:text-gray-700 font-semibold"
              >
                Réduire en bas d&apos;écran
              </button>
              <button
                type="button"
                onClick={() => setViewState("floating")}
                className="btn-primary py-2 px-4 text-xs font-bold shadow-xs"
              >
                Continuer
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
