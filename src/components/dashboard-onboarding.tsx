"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  CheckCircle2,
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
  Store,
  ExternalLink,
  ShieldCheck,
  Zap,
} from "lucide-react";

interface DashboardOnboardingProps {
  totalOrders: number;
  tenantName?: string;
  tenantId?: string;
  hasWaveOrOm?: boolean;
  hasExpenses?: boolean;
}

export function DashboardOnboarding({
  totalOrders,
  tenantName,
  tenantId,
  hasWaveOrOm = false,
  hasExpenses = false,
}: DashboardOnboardingProps) {
  // State: "docked" (slim top banner), "drawer" (slide-over modal), or "floating" (compact round assistant pill)
  const [viewState, setViewState] = useState<"docked" | "drawer" | "floating">("floating");
  const [expandedTip, setExpandedTip] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("pressipro_onboarding_state");
    const welcomeSeen = localStorage.getItem("pressipro_welcome_seen");

    if (saved === "floating" || saved === "docked" || saved === "dismissed") {
      setViewState(saved === "dismissed" ? "floating" : saved);
    } else {
      // First time: docked slim ribbon
      setViewState("docked");
    }

    // Show first-time welcome celebration if zero orders and not yet closed
    if (totalOrders === 0 && !welcomeSeen) {
      setShowWelcomeModal(true);
    }
  }, [totalOrders]);

  const setAndSaveState = (state: "docked" | "drawer" | "floating") => {
    setViewState(state);
    if (state !== "drawer") {
      localStorage.setItem("pressipro_onboarding_state", state);
    }
  };

  const closeWelcomeModal = () => {
    setShowWelcomeModal(false);
    localStorage.setItem("pressipro_welcome_seen", "true");
  };

  const steps = [
    {
      id: "services",
      title: "Tarifs & Services prêts à l'emploi",
      desc: "10 services sénégalais (Boubous, Costumes, Lavage au kilo) déjà configurés.",
      completed: true,
      link: "/settings",
      actionLabel: "Voir / Personnaliser",
      icon: Shirt,
      tip: "Astuce : Vous pouvez ajuster vos prix en 1 clic dans l'onglet Services & Articles et ajouter vos propres prestations.",
    },
    {
      id: "storefront",
      title: "Votre Vitrine & Simulateur en ligne",
      desc: "Un lien public à partager à vos clients pour estimer leur linge et commander.",
      completed: true,
      link: tenantId ? `/p/${tenantId}` : "/settings",
      actionLabel: "Ouvrir ma vitrine",
      isExternal: Boolean(tenantId),
      icon: Store,
      tip: "Astuce : Partagez votre lien de vitrine sur votre statut WhatsApp ou profil Instagram. Vos clients peuvent y choisir leurs vêtements et vous envoyer une demande de collecte.",
    },
    {
      id: "order",
      title: "Enregistrer votre premier dépôt",
      desc: "Saisissez les articles, acompte et date de retrait en moins de 30 secondes.",
      completed: totalOrders > 0,
      link: "/orders/new",
      actionLabel: "Nouveau dépôt",
      icon: PlusCircle,
      tip: "Astuce : Un code unique (ex: P-00001) et un QR code sécurisé sont automatiquement générés sur le reçu imprimé ou envoyé par WhatsApp.",
    },
    {
      id: "whatsapp",
      title: "Notifier par WhatsApp en 1 clic",
      desc: "Prévenez vos clients dès que le linge est prêt sans devoir enregistrer leur numéro.",
      completed: totalOrders > 0,
      link: "/orders",
      actionLabel: "Voir commandes",
      icon: MessageCircle,
      tip: "Astuce : Le bouton WhatsApp sur chaque commande pré-remplit le message avec le nom du client et le montant restant à régler.",
    },
    {
      id: "payment",
      title: "Configurer vos coordonnées Wave & OM",
      desc: "Affichez vos numéros de paiement direct sur les tickets de caisse et reçus digitaux.",
      completed: hasWaveOrOm,
      link: "/settings",
      actionLabel: "Ajouter Wave / OM",
      icon: CreditCard,
      tip: "Astuce : Les clients peuvent scanner le QR code pour payer directement avec l'application Wave sans erreur de numéro.",
    },
    {
      id: "expenses",
      title: "Suivre vos dépenses & rentabilité",
      desc: "Notez vos achats de lessive, Senelec ou carburant pour connaître votre vrai bénéfice.",
      completed: hasExpenses,
      link: "/expenses",
      actionLabel: "Ajouter une dépense",
      icon: Wallet,
      tip: "Astuce : À la fin du mois, PressiPro calcule automatiquement : Chiffre d'Affaires - Dépenses = Bénéfice Net avec la marge en %.",
    },
  ];

  const completedCount = steps.filter((s) => s.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const nextIncompleteStep = steps.find((s) => !s.completed);

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. DOCKED SLIM RIBBON (Responsive, Dark-mode friendly)
      ────────────────────────────────────────────────────────────── */}
      {viewState === "docked" && (
        <div className="relative overflow-hidden rounded-2xl border border-primary-200/80 dark:border-primary-900/60 bg-gradient-to-r from-primary-50/90 via-white to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 p-3 sm:p-3.5 shadow-xs transition-all animate-fade-in">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Left: Icon & Progress */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-500 text-white flex items-center justify-center shadow-xs shrink-0">
                <Sparkles className="w-4 h-4 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                    Guide de Démarrage {tenantName ? `· ${tenantName}` : "PressiPro"}
                  </span>
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950/70 text-primary-800 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/40">
                    {completedCount}/{steps.length} étapes ({progressPercent}%)
                  </span>
                </div>
                {nextIncompleteStep ? (
                  <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate mt-0.5">
                    Étape conseillée :{" "}
                    <strong className="text-gray-800 dark:text-slate-200 font-semibold">
                      {nextIncompleteStep.title}
                    </strong>
                  </p>
                ) : (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                    🎉 Félicitations ! Votre pressing est configuré et prêt à 100%.
                  </p>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <button
                type="button"
                onClick={() => setViewState("drawer")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 active:scale-95 shadow-xs transition-all cursor-pointer"
              >
                <span>Ouvrir le guide</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                onClick={() => setAndSaveState("floating")}
                className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
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
            className="group flex items-center gap-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-primary-200/90 dark:border-primary-900/80 hover:border-primary-400 dark:hover:border-primary-600 rounded-full px-3.5 py-2 shadow-lg shadow-primary-500/15 transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer"
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
                  className="stroke-gray-200 dark:stroke-slate-800"
                  strokeWidth="3.5"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  className="stroke-primary-600 dark:stroke-primary-400 transition-all duration-500"
                  strokeWidth="3.5"
                  strokeDasharray="94.2"
                  strokeDashoffset={94.2 - (94.2 * progressPercent) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <Sparkles className="w-3 h-3 text-primary-600 dark:text-primary-400 absolute" />
            </div>

            <div className="text-left">
              <span className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors block leading-tight">
                Guide ({completedCount}/{steps.length})
              </span>
              <span className="text-[10px] text-gray-400 dark:text-slate-500 block font-medium">
                {progressPercent}% complété
              </span>
            </div>
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. INTERACTIVE ONBOARDING DRAWER (Slide-Over Sheet)
      ────────────────────────────────────────────────────────────── */}
      {viewState === "drawer" && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-gray-900/60 dark:bg-black/75 backdrop-blur-xs z-50 transition-opacity animate-fade-in"
            onClick={() => setViewState("floating")}
            aria-hidden="true"
          />

          {/* Slide-over panel */}
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-gray-200/80 dark:border-slate-800 animate-slide-left">
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-br from-primary-50/80 dark:from-slate-950/80 to-white dark:to-slate-900">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                      Guide Rapide {tenantName ? `· ${tenantName}` : ""}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                      Conseils &amp; étapes quotidiennes
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setAndSaveState("docked")}
                    className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors text-xs font-semibold cursor-pointer"
                    title="Ancrer en haut du tableau de bord"
                  >
                    Ancrer
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewState("floating")}
                    className="p-1.5 text-gray-400 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                    aria-label="Fermer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                  <span className="text-gray-700 dark:text-slate-300">Progression du pressing</span>
                  <span className="text-primary-600 dark:text-primary-400">
                    {completedCount}/{steps.length} validées ({progressPercent}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-gray-200/80 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
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
                        ? "bg-gray-50/70 dark:bg-slate-800/40 border-gray-200/70 dark:border-slate-800"
                        : "bg-white dark:bg-slate-900 border-primary-200/80 dark:border-primary-900/60 shadow-xs ring-1 ring-primary-500/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Check / Status Icon */}
                      <div className="mt-0.5 shrink-0">
                        {step.completed ? (
                          <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 rounded-full border-2 border-primary-500 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-xs">
                            {index + 1}
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4
                            className={`text-sm font-bold truncate ${
                              step.completed
                                ? "text-gray-700 dark:text-slate-300 line-through decoration-gray-400"
                                : "text-gray-900 dark:text-white"
                            }`}
                          >
                            {step.title}
                          </h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                            {step.completed ? "Validé" : "À faire"}
                          </span>
                        </div>

                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {step.desc}
                        </p>

                        {/* Action Link & Tip trigger */}
                        <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-gray-100 dark:border-slate-800 flex-wrap">
                          {step.isExternal ? (
                            <a
                              href={step.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              <span>{step.actionLabel}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <Link
                              href={step.link}
                              onClick={() => setViewState("floating")}
                              className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 dark:text-primary-400 hover:underline"
                            >
                              <span>{step.actionLabel}</span>
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          )}

                          <button
                            type="button"
                            onClick={() => setExpandedTip(isTipOpen ? null : step.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 dark:text-slate-400 hover:text-primary-600 transition-colors cursor-pointer"
                          >
                            <Lightbulb className="w-3 h-3 text-amber-500" />
                            <span>{isTipOpen ? "Masquer" : "Conseil pro"}</span>
                            <ChevronDown
                              className={`w-3 h-3 transition-transform ${isTipOpen ? "rotate-180" : ""}`}
                            />
                          </button>
                        </div>

                        {/* Expandable Pro Tip */}
                        {isTipOpen && (
                          <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed animate-fade-in">
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
            <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/50 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setAndSaveState("floating")}
                className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white font-semibold cursor-pointer"
              >
                Réduire en bas
              </button>
              <button
                type="button"
                onClick={() => setViewState("floating")}
                className="btn-primary py-2 px-4 text-xs font-bold shadow-xs cursor-pointer"
              >
                Continuer
              </button>
            </div>
          </div>
        </>
      )}

      {/* ─────────────────────────────────────────────────────────────
          4. FIRST-TIME WELCOME POPUP MODAL (Modern & Engaging)
      ────────────────────────────────────────────────────────────── */}
      {showWelcomeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 dark:border-slate-800 space-y-5 text-gray-900 dark:text-white animate-scale-up">
            <div className="flex items-start justify-between gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary-600 to-teal-500 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-primary-500/25">
                🎉
              </div>
              <button
                type="button"
                onClick={closeWelcomeModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                aria-label="Fermer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h3 id="welcome-modal-title" className="text-xl font-black text-gray-900 dark:text-white tracking-tight">
                Bienvenue sur PressiPro {tenantName ? `, ${tenantName}` : ""} !
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 leading-relaxed">
                Votre pressing est prêt à fonctionner immédiatement. Voici ce qui est déjà activé pour vous :
              </p>
            </div>

            <div className="space-y-2.5">
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-800/60 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-900 dark:text-emerald-200">10 services sénégalais prêts</p>
                  <p className="text-emerald-800/80 dark:text-emerald-300/80 mt-0.5">Boubou, Chemise, Kilo... vous pouvez enregistrer un dépôt dès maintenant.</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200/70 dark:border-sky-800/60 flex items-start gap-3">
                <Zap className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-sky-900 dark:text-sky-200">Reçus certifiés &amp; Wave</p>
                  <p className="text-sky-800/80 dark:text-sky-300/80 mt-0.5">Partage WhatsApp instantané avec QR code et bouton de paiement Wave.</p>
                </div>
              </div>

              {tenantId && (
                <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/60 flex items-start gap-3">
                  <Store className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-purple-900 dark:text-purple-200">Votre Vitrine en ligne active</p>
                    <p className="text-purple-800/80 dark:text-purple-300/80 mt-0.5">Partagez votre lien public pour que vos clients estiment leur linge en ligne.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/orders/new"
                onClick={closeWelcomeModal}
                className="w-full btn-primary py-3 px-4 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Enregistrer mon premier dépôt (30 sec)</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  closeWelcomeModal();
                  setViewState("drawer");
                }}
                className="w-full py-2.5 px-4 text-xs font-semibold text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                Explorer le guide pas à pas
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
