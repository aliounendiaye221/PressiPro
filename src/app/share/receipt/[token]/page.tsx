"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Download,
  AlertTriangle,
  LoaderCircle,
  Printer,
  MessageCircle,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowRight,
  Sparkles,
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  X,
  ChevronDown,
  ChevronUp,
  MapPin,
  Phone,
  ShoppingBag,
  Award,
  Clock,
  Shirt,
  PackageCheck,
  Calendar,
  Share2,
} from "lucide-react";
import { normalizePhoneForWhatsApp } from "@/lib/phone";

interface OrderItemMeta {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  weight?: number | null;
  pricingType?: "PER_ITEM" | "PER_KG";
}

interface StatusHistoryItem {
  status: "RECU" | "TRAITEMENT" | "PRET" | "LIVRE";
  date: string;
}

interface TenantMeta {
  name: string;
  phone?: string | null;
  address?: string | null;
  waveNumber?: string | null;
  omNumber?: string | null;
  logoUrl?: string | null;
  brandPrimaryColor?: string | null;
  brandAccentColor?: string | null;
}

interface CustomerMeta {
  name: string;
  phone?: string | null;
  ordersCount: number;
  memberSince?: string | null;
}

interface ShareMeta {
  orderId?: string;
  orderCode: string;
  status: "RECU" | "TRAITEMENT" | "PRET" | "LIVRE";
  createdAt: string;
  promisedAt?: string | null;
  totalAmount: number;
  discountAmount: number;
  discountReason?: string | null;
  paidAmount: number;
  amountDue: number;
  paymentStatus: "PAYE" | "PARTIEL" | "IMPAYE";
  items?: OrderItemMeta[];
  statusHistory?: StatusHistoryItem[];
  tenant?: TenantMeta;
  customer?: CustomerMeta;
  // Legacy flat fields for backward compatibility
  tenantName: string;
  tenantPhone?: string | null;
  tenantWaveNumber?: string | null;
  tenantOmNumber?: string | null;
  customerName: string;
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

function formatDateTimeFr(dateStr?: string | null) {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("fr-SN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return null;
  }
}

const STATUS_STEPS = [
  {
    key: "RECU",
    label: "Reçu",
    desc: "Déposé au pressing",
    icon: PackageCheck,
  },
  {
    key: "TRAITEMENT",
    label: "En traitement",
    desc: "Lavage & repassage",
    icon: Shirt,
  },
  {
    key: "PRET",
    label: "Prêt",
    desc: "À récupérer au comptoir",
    icon: Sparkles,
  },
  {
    key: "LIVRE",
    label: "Livré",
    desc: "Linge retiré",
    icon: CheckCircle2,
  },
] as const;

export default function ReceiptSharePage() {
  const { token } = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const [meta, setMeta] = useState<ShareMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Articles list toggle
  const [showItems, setShowItems] = useState(true);

  // Wave payment state
  const [paymentMode, setPaymentMode] = useState<"FULL" | "CUSTOM">("FULL");
  const [customAmount, setCustomAmount] = useState<number | "">("");
  const [waveLoading, setWaveLoading] = useState(false);
  const [waveError, setWaveError] = useState("");
  const [paymentSuccessMsg, setPaymentSuccessMsg] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lien de reçu invalide ou expiré");
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, [token]);

  // Handle return from Wave / CinetPay with short polling for webhook latency
  useEffect(() => {
    loadMeta();

    const paymentParam = searchParams.get("payment");
    const txParam = searchParams.get("tx");
    const providerParam = searchParams.get("provider");

    if (paymentParam !== "return" && !txParam) {
      return;
    }

    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    const checkUrl =
      providerParam === "wave"
        ? `/api/public/receipt/${token}/wave/status?tx=${encodeURIComponent(txParam || "")}`
        : txParam
        ? `/api/public/receipt/${token}/cinetpay/status?tx=${encodeURIComponent(txParam)}`
        : `/api/public/receipt/${token}?meta=1`;

    const pollPayment = async (attempt: number) => {
      if (cancelled) return;
      try {
        const res = await fetch(checkUrl, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (
          data?.status === "ACCEPTED" ||
          data?.data?.status === "ACCEPTED" ||
          data?.paymentStatus === "PAYE" ||
          data?.data?.paymentStatus === "PAYE"
        ) {
          setPaymentSuccessMsg("Paiement validé avec succès ! Votre reçu a été mis à jour.");
          loadMeta(true);
          return;
        }

        if (attempt < 4) {
          timerId = setTimeout(() => pollPayment(attempt + 1), 2500);
        } else {
          loadMeta(true);
        }
      } catch {
        if (!cancelled && attempt < 4) {
          timerId = setTimeout(() => pollPayment(attempt + 1), 2500);
        }
      }
    };

    pollPayment(0);

    return () => {
      cancelled = true;
      if (timerId) clearTimeout(timerId);
    };
  }, [loadMeta, searchParams, token]);

  useEffect(() => {
    if (!directWaveModal.open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDirectWaveModal((prev) => ({ ...prev, open: false }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [directWaveModal.open]);

  const tenantName = meta?.tenant?.name || meta?.tenantName || "PressiPro";
  const tenantPhone = meta?.tenant?.phone || meta?.tenantPhone || "";
  const tenantWave = meta?.tenant?.waveNumber || meta?.tenantWaveNumber || "";
  const tenantAddress = meta?.tenant?.address || "";
  const customerName = meta?.customer?.name || meta?.customerName || "Client";
  const totalItemsCount = useMemo(() => {
    if (!meta?.items) return 0;
    return meta.items.reduce((acc, item) => acc + (item.quantity || 1), 0);
  }, [meta?.items]);

  // Current active step index
  const currentStepIndex = useMemo(() => {
    if (!meta?.status) return 0;
    switch (meta.status) {
      case "RECU":
        return 0;
      case "TRAITEMENT":
        return 1;
      case "PRET":
        return 2;
      case "LIVRE":
        return 3;
      default:
        return 0;
    }
  }, [meta?.status]);

  // Effective payment target amount
  const targetPaymentAmount = useMemo(() => {
    if (!meta || meta.amountDue <= 0) return 0;
    if (paymentMode === "CUSTOM" && typeof customAmount === "number" && customAmount > 0) {
      return Math.min(customAmount, meta.amountDue);
    }
    return meta.amountDue;
  }, [meta, paymentMode, customAmount]);

  const handleWaveCheckout = async () => {
    if (!meta || targetPaymentAmount <= 0) return;
    setWaveLoading(true);
    setWaveError("");

    try {
      const res = await fetch(`/api/public/receipt/${token}/wave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: targetPaymentAmount }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Impossible d'initier le paiement Wave.");
      }

      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
        return;
      }

      if (data?.directWaveNumber || tenantWave || tenantPhone) {
        const phone = (data?.directWaveNumber || tenantWave || tenantPhone || "").replace(/[^0-9+]/g, "");
        setDirectWaveModal({
          open: true,
          phone,
          amount: data?.amount || targetPaymentAmount,
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

  const copyShareLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  // WhatsApp 1-Click shortcuts
  const openWhatsAppPickupNotice = () => {
    if (!meta) return;
    const target = normalizePhoneForWhatsApp(tenantPhone || tenantWave) || tenantPhone.replace(/[^0-9]/g, "");
    const msg = `Bonjour ${tenantName}, je passe d'ici 15 à 30 minutes récupérer ma commande ${meta.orderCode} (${customerName}). Merci !`;
    const url = target
      ? `https://wa.me/${target}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const openWhatsAppDeliveryNotice = () => {
    if (!meta) return;
    const target = normalizePhoneForWhatsApp(tenantPhone || tenantWave) || tenantPhone.replace(/[^0-9]/g, "");
    const msg = `Bonjour ${tenantName}, je souhaite demander une livraison pour ma commande ${meta.orderCode} (${customerName}). Pouvez-vous m'indiquer vos disponibilités ?`;
    const url = target
      ? `https://wa.me/${target}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const shareOnWhatsApp = () => {
    if (!meta) return;
    const text = `Bonjour, voici le reçu de suivi de la commande ${meta.orderCode} chez ${tenantName} : ${window.location.href}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const notifyPressingWhatsAppAfterDirectWave = () => {
    if (!meta) return;
    const target = normalizePhoneForWhatsApp(tenantPhone || tenantWave) || tenantPhone.replace(/[^0-9]/g, "");
    const msg = `Bonjour ${tenantName}, je viens d'effectuer un paiement Wave de ${formatFCFA(directWaveModal.amount || targetPaymentAmount)} pour ma commande ${meta.orderCode}. Pouvez-vous valider mon reçu svp ?`;
    const url = target
      ? `https://wa.me/${target}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank");
  };

  const directWaveE164 = useMemo(() => {
    if (!directWaveModal.phone) return "";
    const digits = normalizePhoneForWhatsApp(directWaveModal.phone) || directWaveModal.phone.replace(/[^0-9]/g, "");
    return digits ? `+${digits}` : "";
  }, [directWaveModal.phone]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-3 py-6 sm:py-10 flex items-start justify-center">
      <div className="w-full max-w-lg space-y-4">
        {/* TOP BRAND HEADER */}
        <header className="rounded-3xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-5 shadow-2xl">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-teal-500/20 shrink-0">
                {tenantName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-black text-white truncate tracking-tight">{tenantName}</h1>
                <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Suivi officiel certifié</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={copyShareLink}
              title="Copier le lien"
              className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer shrink-0"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>

          {tenantAddress && (
            <div className="mt-3.5 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="w-3.5 h-3.5 text-teal-400 shrink-0" />
              <span className="truncate">{tenantAddress}</span>
            </div>
          )}
        </header>

        {/* NOTIFICATIONS & ALERTS */}
        {paymentSuccessMsg && (
          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-950/60 p-4 text-emerald-200 flex items-center gap-3 animate-fade-in shadow-lg">
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <p className="font-semibold text-xs leading-relaxed">{paymentSuccessMsg}</p>
          </div>
        )}

        {loading && (
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-8 flex flex-col items-center justify-center gap-3 text-slate-300 text-sm">
            <LoaderCircle className="h-7 w-7 animate-spin text-teal-400" />
            <span>Chargement sécurisé de votre commande...</span>
          </div>
        )}

        {!!error && (
          <div className="rounded-3xl border border-red-500/30 bg-red-950/60 p-5 text-red-200 space-y-1">
            <p className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="h-4 w-4 text-red-400" /> Lien invalide ou indisponible
            </p>
            <p className="text-xs text-red-300/90">{error}</p>
          </div>
        )}

        {meta && !error && (
          <>
            {/* LIVE ORDER TRACKER CARD */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-5 sm:p-6 shadow-2xl space-y-5">
              <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-4">
                <div>
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Commande
                  </span>
                  <span className="text-xl font-black text-white font-mono tracking-tight">
                    {meta.orderCode}
                  </span>
                </div>

                <div className="text-right">
                  {meta.paymentStatus === "PAYE" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 className="w-3.5 h-3.5" /> SOLDÉ
                    </span>
                  )}
                  {meta.paymentStatus === "PARTIEL" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-300 border border-amber-500/30">
                      <Clock className="w-3.5 h-3.5" /> ACOMPTE VERSÉ
                    </span>
                  )}
                  {meta.paymentStatus === "IMPAYE" && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-500/15 text-rose-300 border border-rose-500/30">
                      NON PAYÉ
                    </span>
                  )}
                </div>
              </div>

              {/* DYNAMIC HERO STATUS BANNER */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  meta.status === "PRET"
                    ? "bg-gradient-to-r from-emerald-950/80 to-teal-950/80 border-emerald-500/40 text-emerald-100 shadow-lg shadow-emerald-900/20"
                    : meta.status === "TRAITEMENT"
                    ? "bg-gradient-to-r from-sky-950/80 to-blue-950/80 border-sky-500/40 text-sky-100"
                    : meta.status === "LIVRE"
                    ? "bg-gradient-to-r from-slate-800 to-slate-850 border-white/10 text-slate-200"
                    : "bg-gradient-to-r from-teal-950/70 to-slate-850 border-teal-500/30 text-teal-100"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-2.5 rounded-xl shrink-0 ${
                      meta.status === "PRET"
                        ? "bg-emerald-500 text-white animate-bounce"
                        : meta.status === "TRAITEMENT"
                        ? "bg-sky-500 text-white"
                        : meta.status === "LIVRE"
                        ? "bg-slate-700 text-white"
                        : "bg-teal-500 text-white"
                    }`}
                  >
                    {meta.status === "PRET" ? (
                      <Sparkles className="w-5 h-5 fill-white" />
                    ) : meta.status === "TRAITEMENT" ? (
                      <Shirt className="w-5 h-5" />
                    ) : meta.status === "LIVRE" ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <PackageCheck className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-sm font-black tracking-tight">
                      {meta.status === "PRET" && "🎉 Votre linge est prêt !"}
                      {meta.status === "TRAITEMENT" && "🧼 En cours de lavage & repassage"}
                      {meta.status === "RECU" && "📥 Commande bien enregistrée"}
                      {meta.status === "LIVRE" && "✨ Commande livrée & retirée"}
                    </h2>
                    <p className="text-xs opacity-90 mt-0.5 leading-relaxed">
                      {meta.status === "PRET" && "Vos vêtements sont lavés, repassés et emballés. Vous pouvez passer les récupérer au comptoir."}
                      {meta.status === "TRAITEMENT" && "Notre équipe prend soin de vos vêtements avec le plus grand soin."}
                      {meta.status === "RECU" && "Votre dépôt a été pris en charge au guichet."}
                      {meta.status === "LIVRE" && "Merci pour votre confiance chez " + tenantName + "."}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4-STEP VISUAL TRACKER */}
              <div className="pt-2">
                <div className="grid grid-cols-4 gap-2 relative">
                  {STATUS_STEPS.map((step, idx) => {
                    const isCompleted = idx < currentStepIndex;
                    const isCurrent = idx === currentStepIndex;
                    const StepIcon = step.icon;

                    return (
                      <div key={step.key} className="flex flex-col items-center text-center relative group">
                        {/* Circle */}
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs transition-all duration-300 z-10 shadow-md ${
                            isCurrent
                              ? "bg-teal-400 text-slate-950 ring-4 ring-teal-400/20 scale-110"
                              : isCompleted
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-800 text-slate-500 border border-white/5"
                          }`}
                        >
                          {isCompleted ? <Check className="w-4 h-4 stroke-[3]" /> : <StepIcon className="w-4 h-4" />}
                        </div>

                        {/* Label */}
                        <span
                          className={`mt-2 text-[11px] font-bold leading-tight block truncate w-full ${
                            isCurrent
                              ? "text-teal-300"
                              : isCompleted
                              ? "text-slate-200"
                              : "text-slate-500"
                          }`}
                        >
                          {step.label}
                        </span>
                        <span className="text-[9px] text-slate-500 hidden sm:block mt-0.5 truncate w-full">
                          {step.desc}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* DATES & DEADLINE CARD */}
              <div className="grid grid-cols-2 gap-2.5 pt-1 text-xs">
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-teal-400" /> Déposé le
                  </span>
                  <p className="mt-1 font-semibold text-slate-200 text-xs">
                    {formatDateTimeFr(meta.createdAt) || "Récemment"}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" /> Prêt prévu
                  </span>
                  <p className="mt-1 font-semibold text-slate-200 text-xs">
                    {formatDateTimeFr(meta.promisedAt) || "Selon délai habituel"}
                  </p>
                </div>
              </div>
            </section>

            {/* GARMENT DETAILS ACCORDION */}
            {meta.items && meta.items.length > 0 && (
              <section className="rounded-3xl border border-white/10 bg-slate-900/90 backdrop-blur-xl overflow-hidden shadow-2xl transition-all">
                <button
                  type="button"
                  onClick={() => setShowItems((prev) => !prev)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">Détail des vêtements</h3>
                      <p className="text-xs text-slate-400">
                        {totalItemsCount} article{totalItemsCount > 1 ? "s" : ""} confié{totalItemsCount > 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="text-xs font-semibold">{showItems ? "Masquer" : "Afficher"}</span>
                    {showItems ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {showItems && (
                  <div className="px-5 pb-5 pt-1 space-y-3 border-t border-white/5 animate-fade-in">
                    <div className="divide-y divide-white/5">
                      {meta.items.map((item, index) => (
                        <div key={index} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-200 truncate">{item.name}</p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {item.pricingType === "PER_KG" && item.weight
                                ? `${item.weight} kg × ${formatFCFA(item.unitPrice)}/kg`
                                : `${item.quantity} pièce${item.quantity > 1 ? "s" : ""} × ${formatFCFA(item.unitPrice)}`}
                            </p>
                          </div>
                          <span className="font-mono font-bold text-slate-200 shrink-0">
                            {formatFCFA(item.total)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* FINANCIAL SUMMARY */}
                    <div className="pt-3 border-t border-white/10 space-y-2 text-xs">
                      <div className="flex justify-between text-slate-400">
                        <span>Sous-total</span>
                        <span className="font-mono text-slate-300">
                          {formatFCFA(meta.totalAmount + (meta.discountAmount || 0))}
                        </span>
                      </div>

                      {meta.discountAmount > 0 && (
                        <div className="flex justify-between text-emerald-400">
                          <span>Remise accordée {meta.discountReason ? `(${meta.discountReason})` : ""}</span>
                          <span className="font-mono font-bold">-{formatFCFA(meta.discountAmount)}</span>
                        </div>
                      )}

                      <div className="flex justify-between text-slate-400">
                        <span>Déjà réglé</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          {formatFCFA(meta.paidAmount)}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-white/10 flex justify-between items-center text-sm">
                        <span className="font-bold text-white">Reste à payer</span>
                        <span
                          className={`font-black font-mono text-base ${
                            meta.amountDue > 0 ? "text-amber-400" : "text-emerald-400"
                          }`}
                        >
                          {meta.amountDue > 0 ? formatFCFA(meta.amountDue) : "0 FCFA (Soldé)"}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* WAVE DIRECT PAYMENT SECTION (IF UNPAID) */}
            {meta.amountDue > 0 && (
              <section className="rounded-3xl border-2 border-[#1DA1F2]/40 bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-900 p-5 sm:p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#1DA1F2] to-[#0c85d0] text-white flex items-center justify-center shadow-lg shadow-[#1DA1F2]/25">
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-sm font-black text-white flex items-center gap-1.5">
                        Règlement Wave Express
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      </h2>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Zéro frais • Validation instantanée
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#1DA1F2]/20 border border-[#1DA1F2]/30 text-[10px] font-bold text-[#1DA1F2]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1DA1F2] animate-pulse" />
                    Direct
                  </span>
                </div>

                {/* PAYMENT AMOUNT CHOICE (FULL VS CUSTOM DEPOSIT) */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("FULL");
                      setCustomAmount("");
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      paymentMode === "FULL"
                        ? "bg-[#1DA1F2]/20 border-[#1DA1F2] text-white shadow-md shadow-[#1DA1F2]/10"
                        : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold block opacity-80">Régler la totalité</span>
                    <span className="font-mono font-black text-sm text-white mt-0.5 block">
                      {formatFCFA(meta.amountDue)}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("CUSTOM");
                      if (!customAmount) setCustomAmount(Math.min(2000, meta.amountDue));
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      paymentMode === "CUSTOM"
                        ? "bg-[#1DA1F2]/20 border-[#1DA1F2] text-white shadow-md shadow-[#1DA1F2]/10"
                        : "bg-white/5 border-white/5 text-slate-400 hover:bg-white/10"
                    }`}
                  >
                    <span className="text-[10px] uppercase font-bold block opacity-80">Verser un acompte</span>
                    <span className="font-bold text-sm text-white mt-0.5 block truncate">
                      {typeof customAmount === "number" && customAmount > 0 ? formatFCFA(customAmount) : "Montant libre"}
                    </span>
                  </button>
                </div>

                {paymentMode === "CUSTOM" && (
                  <div className="space-y-2 p-3 rounded-2xl bg-white/5 border border-white/10 animate-fade-in">
                    <label className="text-[11px] font-medium text-slate-300 block">
                      Montant de l&apos;acompte à verser (FCFA) :
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={100}
                        max={meta.amountDue}
                        value={customAmount}
                        onChange={(e) => {
                          const val = e.target.value === "" ? "" : Number(e.target.value);
                          setCustomAmount(val);
                        }}
                        placeholder={`Max: ${meta.amountDue}`}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/15 text-white font-mono text-sm focus:outline-hidden focus:border-[#1DA1F2]"
                      />
                    </div>
                    {/* Quick shortcuts */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {[1000, 2000, 5000].filter((v) => v < meta.amountDue).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setCustomAmount(v)}
                          className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-mono font-semibold text-slate-200 transition-colors"
                        >
                          +{formatFCFA(v)}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setCustomAmount(meta.amountDue)}
                        className="px-2.5 py-1 rounded-lg bg-[#1DA1F2]/20 hover:bg-[#1DA1F2]/30 text-[11px] font-mono font-bold text-[#1DA1F2] transition-colors"
                      >
                        Solde ({formatFCFA(meta.amountDue)})
                      </button>
                    </div>
                  </div>
                )}

                {waveError && (
                  <div className="rounded-xl bg-red-950/80 border border-red-500/30 p-2.5 text-xs text-red-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{waveError}</span>
                  </div>
                )}

                {/* MAIN WAVE TRIGGER BUTTON */}
                <button
                  type="button"
                  onClick={handleWaveCheckout}
                  disabled={waveLoading || targetPaymentAmount <= 0}
                  className="w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[#1DA1F2] via-[#0c85d0] to-[#0070ba] hover:from-[#1a8cd8] hover:to-[#005a96] text-white font-black py-4 px-4 text-sm shadow-xl shadow-[#1DA1F2]/25 hover:shadow-[#1DA1F2]/40 transition-all duration-200 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                >
                  {waveLoading ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Connexion à Wave en cours...
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 fill-white" />
                      Payer {formatFCFA(targetPaymentAmount)} avec Wave
                      <ArrowRight className="h-4 w-4 ml-0.5" />
                    </>
                  )}
                </button>

                <p className="text-[10px] text-center text-slate-500">
                  Ouverture automatique de votre application Wave • Sécurisé par Wave Sénégal
                </p>
              </section>
            )}

            {/* FAST ACTIONS & CONTACT PRESSING */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-5 shadow-2xl space-y-3">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Actions rapides &amp; Contact
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {meta.status === "PRET" && (
                  <button
                    type="button"
                    onClick={openWhatsAppPickupNotice}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 px-4 py-3 text-xs font-bold text-emerald-300 transition-all cursor-pointer"
                  >
                    <span>🏃 Je passe chercher mon linge</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={openWhatsAppDeliveryNotice}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-xs font-bold text-slate-200 transition-all cursor-pointer"
                >
                  <span>🛵 Demander une livraison</span>
                </button>

                {tenantPhone && (
                  <a
                    href={`tel:${tenantPhone.replace(/[^0-9+]/g, "")}`}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-xs font-bold text-slate-200 transition-all"
                  >
                    <Phone className="w-3.5 h-3.5 text-teal-400" />
                    <span>Appeler {tenantName}</span>
                  </a>
                )}

                <button
                  type="button"
                  onClick={shareOnWhatsApp}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-3 text-xs font-bold text-slate-200 transition-all cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Partager le reçu</span>
                </button>
              </div>

              {/* ESTIMATE / SIMULATOR LINK */}
              {(meta.tenant?.id || meta.tenantId) && (
                <a
                  href={`/p/${meta.tenant?.id || meta.tenantId}`}
                  className="flex w-full items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-teal-950/60 to-slate-850 border border-teal-500/30 text-teal-200 hover:border-teal-500/50 transition-all group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-teal-500/20 text-teal-300">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold text-white">Estimer mon prochain linge</p>
                      <p className="text-[11px] text-slate-400">Consulter tous les tarifs de {tenantName}</p>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-teal-400 group-hover:translate-x-0.5 transition-transform" />
                </a>
              )}

              {/* PDF ACTIONS */}
              <div className="pt-2 border-t border-white/5 flex gap-2">
                <a
                  href={downloadUrl}
                  className="flex-1 flex items-center justify-center gap-2 rounded-2xl bg-teal-600 hover:bg-teal-500 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-teal-600/20 transition-all"
                >
                  <Download className="h-4 w-4" />
                  <span>Télécharger le Reçu PDF</span>
                </a>

                <a
                  href={inlineUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all shrink-0"
                  title="Consulter / Imprimer"
                >
                  <Printer className="h-4 w-4" />
                </a>
              </div>
            </section>

            {/* LOYALTY & VISIT COUNTER BADGE */}
            {meta.customer && meta.customer.ordersCount > 1 && (
              <footer className="rounded-3xl border border-white/5 bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 p-4 flex items-center justify-between text-xs shadow-lg">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-white">Client fidèle chez {tenantName}</p>
                    <p className="text-[11px] text-amber-300/80">
                      {meta.customer.ordersCount} commandes enregistrées
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-black tracking-wider uppercase bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg border border-amber-500/30">
                  VIP
                </span>
              </footer>
            )}
          </>
        )}
      </div>

      {/* MODAL ENVOI DIRECT WAVE */}
      {directWaveModal.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="direct-wave-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-fade-in"
        >
          <div className="bg-slate-900 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-white/10 text-slate-100">
            <div className="flex items-center justify-between border-b pb-3 border-white/10">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#1DA1F2]/20 text-[#1DA1F2]">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 id="direct-wave-modal-title" className="font-bold text-sm text-white">
                  Paiement Wave Direct
                </h3>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setDirectWaveModal((prev) => ({ ...prev, open: false }))}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Ouvrez votre application Wave et envoyez{" "}
              <strong className="text-white font-mono">{formatFCFA(directWaveModal.amount)}</strong> au numéro suivant :
            </p>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Numéro Wave Pressing</span>
                <span className="text-base font-mono font-black text-white">{directWaveModal.phone}</span>
              </div>
              <button
                type="button"
                onClick={copyWaveNumber}
                className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1 hover:bg-white/20 cursor-pointer"
              >
                {directWaveModal.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copié</span>
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
              {directWaveE164 && (
                <a
                  href={`https://wave.com/send?phone=${encodeURIComponent(directWaveE164)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-[#1DA1F2] hover:bg-[#0c85d0] text-white font-bold text-xs shadow-lg shadow-[#1DA1F2]/25 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ouvrir l&apos;application Wave
                </a>
              )}

              <button
                type="button"
                onClick={notifyPressingWhatsAppAfterDirectWave}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
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
