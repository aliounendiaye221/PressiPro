"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  CalendarDays,
  Calendar,
  AlertTriangle,
  Banknote,
  Clock,
  CheckCircle2,
  Truck,
  Inbox,
  CreditCard,
  Smartphone,
  Wallet,
  WifiOff,
  PlusCircle,
  QrCode,
  MessageCircle,
  Package,
  ArrowRight,
  ChevronRight,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { formatOfflineCacheTime, readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import { useAuth } from "@/components/auth-provider";
import { normalizePhoneForWhatsApp } from "@/lib/phone";
import { DashboardOnboarding } from "@/components/dashboard-onboarding";
import { AnimatedNumber } from "@/components/animated-number";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { actionFeedback, triggerHaptic } from "@/lib/feedback";
import { ModernAreaChart } from "@/components/charts/modern-area-chart";
import { ModernDonutChart } from "@/components/charts/modern-donut-chart";

interface DashboardData {
  revenue: { day: number; week: number; month: number };
  growth?: {
    day: number | null;
    week: number | null;
    month: number | null;
  };
  weeklyDailyRevenue?: number[];
  weeklyDailyOrders?: number[];
  averageOrderValue?: number;
  monthOrdersCount?: number;
  topServices?: {
    name: string;
    quantity: number;
    total: number;
    percentage: number;
  }[];
  monthlyFinancials?: {
    revenue: number;
    expenses: number;
    netProfit: number;
    margin: number;
    isProfit: boolean;
    expenseCount: number;
  };
  hasExpenses?: boolean;
  totalUnpaid: number;
  lateOrders: number;
  ordersByStatus: Record<string, number>;
  paymentsByMethod: { method: string; total: number; count: number }[];
  recentPayments?: {
    id: string;
    orderId?: string;
    amount: number;
    method: string;
    orderCode: string;
    customerName: string;
    agentName?: string;
    createdAt: string;
  }[];
  urgentOrders: {
    id: string;
    code: string;
    promisedAt: string;
    status: string;
    customer: { name: string; phone: string };
  }[];
  todaysOrders: {
    id: string;
    code: string;
    promisedAt: string;
    status: string;
    customer: { name: string; phone: string };
  }[];
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

function GrowthBadge({
  value,
  periodLabel,
}: {
  value?: number | null;
  periodLabel: string;
}) {
  if (value === undefined || value === null) return null;
  const isPositive = value > 0;
  const isNeutral = value === 0;

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
        isNeutral
          ? "bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400"
          : isPositive
          ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-800/40"
          : "bg-red-100 dark:bg-red-950/70 text-red-800 dark:text-red-300 border border-red-200/50 dark:border-red-800/40"
      }`}
      title={`Évolution de ${isPositive ? "+" : ""}${value}% vs ${periodLabel}`}
    >
      <span>{isPositive ? "↑" : isNeutral ? "=" : "↓"}</span>
      <span>{isPositive ? `+${value}%` : `${value}%`}</span>
    </span>
  );
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  OM: "Orange Money",
  WAVE: "Wave",
  OTHER: "Autre",
};

const METHOD_ICONS: Record<string, typeof Wallet> = {
  CASH: Banknote,
  OM: Smartphone,
  WAVE: CreditCard,
  OTHER: Wallet,
};

const DASHBOARD_CACHE_KEY = "dashboard:summary";

function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton h-8 w-48 rounded-xl" />
          <div className="skeleton h-4 w-64 rounded-lg" />
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="skeleton h-10 flex-1 sm:flex-none w-28 rounded-xl" />
          <div className="skeleton h-10 flex-1 sm:flex-none w-36 rounded-xl" />
        </div>
      </div>

      {/* 5 KPI cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`bg-white dark:bg-slate-900 rounded-2xl p-4 sm:p-5 border border-gray-100/80 dark:border-slate-800 shadow-sm space-y-3 ${i === 4 ? "col-span-2 md:col-span-1" : ""}`}>
            <div className="flex items-center gap-2">
              <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
              <div className="skeleton h-3 w-16 rounded-md" />
            </div>
            <div className="skeleton h-7 w-28 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Status grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl p-4 text-center border border-gray-100/80 dark:border-slate-800 shadow-sm flex flex-col items-center gap-2">
            <div className="skeleton w-8 h-8 sm:w-10 sm:h-10 rounded-xl" />
            <div className="skeleton h-6 w-8 rounded-md" />
            <div className="skeleton h-3 w-12 rounded-md" />
          </div>
        ))}
      </div>

      {/* Panels skeleton */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-100/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="skeleton h-5 w-36 rounded-md" />
          <div className="space-y-3">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-12 skeleton rounded-xl" />
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-gray-100/80 dark:border-slate-800 shadow-sm space-y-4">
          <div className="skeleton h-5 w-36 rounded-md" />
          <div className="space-y-3">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="h-12 skeleton rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, tenant } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        throw new Error("dashboard-fetch-failed");
      }

      const nextData = (await response.json()) as DashboardData;
      setData(nextData);
      setUsingCache(false);
      setCacheUpdatedAt(new Date().toISOString());
      writeOfflineCache(DASHBOARD_CACHE_KEY, nextData);
    } catch {
      const cached = readOfflineCache<DashboardData>(DASHBOARD_CACHE_KEY);
      if (cached) {
        setData(cached.data);
        setUsingCache(true);
        setCacheUpdatedAt(cached.updatedAt);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const syncNetworkState = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);

    loadDashboard();

    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, [loadDashboard]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) return <p className="text-gray-500 dark:text-slate-400 text-center py-12">Erreur de chargement</p>;

  const statusConfig = [
    { key: "RECU", label: "Reçu", icon: Inbox, color: "from-blue-500 to-blue-600", bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", glow: "hover:shadow-blue-500/10 hover:border-blue-200 dark:hover:border-blue-800" },
    { key: "TRAITEMENT", label: "En traitement", icon: Clock, color: "from-amber-500 to-amber-600", bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", glow: "hover:shadow-amber-500/10 hover:border-amber-200 dark:hover:border-amber-800" },
    { key: "PRET", label: "Prêt", icon: CheckCircle2, color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", glow: "hover:shadow-emerald-500/10 hover:border-emerald-200 dark:hover:border-emerald-800" },
    { key: "LIVRE", label: "Livré", icon: Truck, color: "from-gray-400 to-gray-500", bg: "bg-gray-50 dark:bg-slate-800/60", text: "text-gray-700 dark:text-slate-300", glow: "hover:shadow-gray-500/10 hover:border-gray-200 dark:hover:border-slate-700" },
  ];

  const handleScan = (decodedText: string) => {
    setIsScannerOpen(false);
    actionFeedback("tap");
    try {
      const url = new URL(decodedText);
      const uuid = url.pathname.split("/").pop();
      if (uuid) {
        router.push(`/orders?q=${encodeURIComponent(decodedText)}`);
      }
    } catch {
      router.push(`/orders?q=${encodeURIComponent(decodedText)}`);
    }
  };

  const openWhatsApp = (phone: string, customerName: string, orderCode: string) => {
    actionFeedback("success");
    const pressingName = tenant?.name || "PressiPro";
    const message = `🧺 *${pressingName}*\nBonjour *${customerName || "cher client"}*,\n\nVotre linge déposé sous la commande *${orderCode}* est *PRÊT* et disponible en boutique ! ✨\n\nMerci de votre confiance et à très bientôt ! 🙏`;
    const cleanPhone = normalizePhoneForWhatsApp(phone) || phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Status badge style helper
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "RECU":
        return "badge-glow-blue";
      case "TRAITEMENT":
        return "badge-glow-amber";
      case "PRET":
        return "badge-glow-emerald";
      case "LIVRE":
        return "badge-glow-gray";
      default:
        return "badge-glow-gray";
    }
  };

  // Audit item 2: Real day-by-day weekly revenue totals
  const sparklineData =
    data.weeklyDailyRevenue && data.weeklyDailyRevenue.length === 7
      ? data.weeklyDailyRevenue
      : [0, 0, 0, 0, 0, 0, 0];

  const minVal = Math.min(...sparklineData);
  const maxVal = Math.max(...sparklineData, 1000); // ensure non-zero range
  const range = maxVal - minVal || 1;

  const points = sparklineData.map((val, i) => ({
    x: (i / (sparklineData.length - 1)) * 90,
    y: 32 - ((val - minVal) / range) * 22,
  }));
  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const pathStr = `M 0,35 L ${points.map((p) => `${p.x},${p.y}`).join(" L ")} L 90,35 Z`;

  // Compute 2026 Donut Payment Segments
  const METHOD_COLORS: Record<string, string> = {
    CASH: "#10b981", // Emerald
    WAVE: "#06b6d4", // Cyan
    OM: "#f97316", // Orange
    CARD: "#8b5cf6", // Purple
    OTHER: "#ec4899", // Pink
  };
  const paymentSegments = (data.paymentsByMethod || []).map((p) => ({
    id: p.method,
    label: METHOD_LABELS[p.method] || p.method,
    value: p.total,
    count: p.count,
    color: METHOD_COLORS[p.method] || "#64748b",
  }));

  return (
    <PullToRefresh onRefresh={loadDashboard}>
      <div className="space-y-8 animate-fade-in">
        {(isOffline || usingCache) && data && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 animate-fade-in">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>
              Affichage hors ligne à partir des dernières données synchronisées
              {formatOfflineCacheTime(cacheUpdatedAt) ? ` le ${formatOfflineCacheTime(cacheUpdatedAt)}` : ""}.
            </span>
          </div>
        )}

        {/* Header & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
              Bonjour, {user?.name?.split(" ")[0] || "l'équipe"} 👋
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Vue d&apos;ensemble de votre activité en temps réel
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                actionFeedback("tap");
                setIsScannerOpen(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors shadow-sm active:scale-[0.97]"
            >
              <QrCode className="w-4 h-4 text-primary-600 dark:text-primary-400 animate-pulse-glow" />
              <span>Scanner</span>
            </button>
            <Link
              href="/orders/new"
              onClick={() => actionFeedback("tap")}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm shadow-primary-600/20 active:scale-[0.97]"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nouveau dépôt</span>
            </Link>
          </div>
        </div>

        {/* Onboarding Guide for daily use */}
        <DashboardOnboarding
          totalOrders={Object.values(data.ordersByStatus).reduce((a, b) => a + b, 0)}
          tenantName={tenant?.name}
          hasWaveOrOm={Boolean(tenant?.waveNumber || tenant?.omNumber)}
          hasExpenses={data.hasExpenses}
        />

        {/* 5 Owner Master KPI Cards with Growth Badges & Panier Moyen (100% Mobile Responsive) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          {/* 1. CA Jour */}
          <Link
            href="/orders?period=today"
            className="card-levitate glow-card glow-card-emerald bg-gradient-to-br from-emerald-50/40 dark:from-emerald-950/20 via-white dark:via-slate-900 to-white dark:to-slate-900 relative overflow-hidden block transition-all hover:scale-[1.02] active:scale-[0.98] group"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-200/40 dark:from-emerald-800/20 to-transparent rounded-bl-[50px] opacity-70 group-hover:scale-110 transition-transform duration-300" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform shrink-0">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
                    CA Jour
                  </span>
                </div>
                <GrowthBadge value={data.growth?.day} periodLabel="hier" />
              </div>
              <p className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white truncate">
                <AnimatedNumber value={data.revenue.day} suffix=" F" />
              </p>
              <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1 flex items-center gap-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                <span>Voir le jour</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </p>
            </div>
          </Link>

          {/* 2. CA Semaine */}
          <Link
            href="/orders?period=week"
            className="card-levitate glow-card bg-gradient-to-br from-primary-50/40 dark:from-primary-950/20 via-white dark:via-slate-900 to-white dark:to-slate-900 relative overflow-hidden block transition-all hover:scale-[1.02] active:scale-[0.98] group"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary-200/40 dark:from-primary-800/20 to-transparent rounded-bl-[50px] opacity-70 group-hover:scale-110 transition-transform duration-300" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-primary-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20 group-hover:scale-105 transition-transform shrink-0">
                    <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">
                    CA Sem.
                  </span>
                </div>
                <GrowthBadge value={data.growth?.week} periodLabel="semaine passée" />
              </div>
              <div className="flex items-end justify-between">
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white truncate">
                    <AnimatedNumber value={data.revenue.week} suffix=" F" />
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1 flex items-center gap-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                    <span>Voir la semaine</span>
                    <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                  </p>
                </div>

                {/* Mini Sparkline Graph */}
                <div className="hidden sm:block absolute right-0 bottom-0 opacity-40 pointer-events-none pr-1 pb-1">
                  <svg width="90" height="35" className="overflow-visible">
                    <defs>
                      <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={pathStr} fill="url(#sparkline-grad)" />
                    <polyline
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={pointsStr}
                    />
                  </svg>
                </div>
              </div>
            </div>
          </Link>

          {/* 3. CA Mois */}
          <Link
            href={isAdmin ? "/expenses" : "/orders?period=month"}
            className="card-levitate glow-card glow-card-violet bg-gradient-to-br from-violet-50/40 dark:from-violet-950/20 via-white dark:via-slate-900 to-white dark:to-slate-900 relative overflow-hidden block transition-all hover:scale-[1.02] active:scale-[0.98] group"
            title={isAdmin ? "Consulter le bilan mensuel et les dépenses" : "Consulter les commandes du mois"}
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-200/40 dark:from-violet-800/20 to-transparent rounded-bl-[50px] opacity-70 group-hover:scale-110 transition-transform duration-300" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-violet-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20 group-hover:scale-105 transition-transform shrink-0">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                    CA Mois
                  </span>
                </div>
                <GrowthBadge value={data.growth?.month} periodLabel="mois passé" />
              </div>
              <p className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white truncate">
                <AnimatedNumber value={data.revenue.month} suffix=" F" />
              </p>
              {isAdmin && data.monthlyFinancials && data.monthlyFinancials.expenses > 0 ? (
                <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                  <span>Net: <strong className={data.monthlyFinancials.isProfit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>{data.monthlyFinancials.isProfit ? "+" : ""}{formatFCFA(data.monthlyFinancials.netProfit)}</strong></span>
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 dark:text-slate-400 mt-1 flex items-center gap-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                  <span>{isAdmin ? "Bilan du mois" : "Commandes du mois"}</span>
                  <span className="group-hover:translate-x-0.5 transition-transform">→</span>
                </p>
              )}
            </div>
          </Link>

          {/* 4. Panier Moyen (Owner KPI) */}
          <div
            className="card-levitate glow-card glow-card-amber bg-gradient-to-br from-amber-50/40 dark:from-amber-950/20 via-white dark:via-slate-900 to-white dark:to-slate-900 relative overflow-hidden block transition-all hover:scale-[1.02] active:scale-[0.98] group"
            title="Panier moyen par commande ce mois-ci"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-amber-200/40 dark:from-amber-800/20 to-transparent rounded-bl-[50px] opacity-70 group-hover:scale-110 transition-transform duration-300" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-amber-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform shrink-0">
                    <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors">
                    Panier Moy.
                  </span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                  Moyenne
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white truncate">
                <AnimatedNumber value={data.averageOrderValue || 0} suffix=" F" />
              </p>
              <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1 truncate">
                <span>{data.monthOrdersCount || 0} commande{data.monthOrdersCount && data.monthOrdersCount > 1 ? "s" : ""}</span>
              </p>
            </div>
          </div>

          {/* 5. Impayés (Spans 2 cols on mobile, 1 col on desktop) */}
          <Link
            href="/orders?unpaid=true"
            className="card-levitate glow-card glow-card-red bg-gradient-to-br from-red-50/40 dark:from-red-950/20 via-white dark:via-slate-900 to-white dark:to-slate-900 relative overflow-hidden block transition-all hover:scale-[1.02] active:scale-[0.98] col-span-2 md:col-span-1 group"
            title="Cliquez pour afficher toutes les commandes impayées"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-200/40 dark:from-red-800/20 to-transparent rounded-bl-[50px] opacity-70 group-hover:scale-110 transition-transform duration-300" />
            <div className="relative">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 bg-red-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:scale-105 transition-transform shrink-0">
                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400 group-hover:text-red-700 dark:group-hover:text-red-300 transition-colors">
                    Impayés
                  </span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300">
                  À encaisser
                </span>
              </div>
              <p className="text-lg sm:text-2xl font-black text-red-600 dark:text-red-400 truncate">
                <AnimatedNumber value={data.totalUnpaid} suffix=" F" />
              </p>
              <p className="text-[11px] text-red-500 dark:text-red-400 font-semibold mt-1 flex items-center gap-1 truncate">
                <span>Voir les impayés</span>
                <span className="group-hover:translate-x-0.5 transition-transform">→</span>
              </p>
            </div>
          </Link>
        </div>

        {/* Synchronized Financial Health Ribbon (Admins only) */}
        {isAdmin && data.monthlyFinancials && data.monthlyFinancials.revenue > 0 && (
          <div className="bg-gradient-to-r from-emerald-500/10 via-primary-500/5 to-white dark:to-slate-900 border border-emerald-500/20 dark:border-emerald-800/40 rounded-2xl p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-fade-in">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-xs ${data.monthlyFinancials.isProfit ? "bg-emerald-600" : "bg-red-600"}`}>
                {data.monthlyFinancials.isProfit ? "✓" : "!"}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-gray-900 dark:text-white">
                    {data.monthlyFinancials.isProfit ? "Bilan Mensuel Positif (Bénéfice)" : "Bilan Mensuel Déficitaire"}
                  </span>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${data.monthlyFinancials.isProfit ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300" : "bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300"}`}>
                    Marge nette : {data.monthlyFinancials.margin}%
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-slate-300 mt-0.5">
                  Revenus encaissés : <strong className="text-gray-900 dark:text-white">{formatFCFA(data.monthlyFinancials.revenue)}</strong> · Dépenses saisies : <strong className="text-red-600 dark:text-red-400">-{formatFCFA(data.monthlyFinancials.expenses)}</strong> · Gain net : <strong className={data.monthlyFinancials.isProfit ? "text-emerald-700 dark:text-emerald-400 font-black" : "text-red-700 dark:text-red-400 font-black"}>{data.monthlyFinancials.isProfit ? "+" : ""}{formatFCFA(data.monthlyFinancials.netProfit)}</strong>
                </p>
              </div>
            </div>

            <Link
              href="/expenses"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 border border-emerald-200/80 dark:border-emerald-800/60 shadow-xs transition-colors self-start sm:self-auto shrink-0"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Gérer Dépenses & Bilan</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
            </Link>
          </div>
        )}

        {/* Status grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {statusConfig.map(({ key, label, icon: Icon, bg, text, glow }) => (
            <Link
              key={key}
              href={`/orders?status=${key}`}
              className={`card-levitate rounded-2xl bg-white dark:bg-slate-900 p-4 text-center border border-gray-100 dark:border-slate-800 shadow-sm cursor-pointer group hover:bg-gradient-to-b hover:from-white hover:to-gray-50/20 dark:hover:to-slate-800/20 transition-all hover:scale-[1.03] active:scale-[0.97] block ${glow}`}
              title={`Filtrer par statut: ${label}`}
            >
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md`}>
                <Icon className={`w-5 h-5 ${text}`} />
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white transition-colors duration-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                <AnimatedNumber value={data.ordersByStatus[key] || 0} formatAsFCFA={false} />
              </p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 font-semibold flex items-center justify-center gap-1">
                <span>{label}</span>
                <span className="text-gray-300 dark:text-slate-600 group-hover:text-primary-600 dark:group-hover:text-primary-400 text-[10px] transition-colors">→</span>
              </p>
            </Link>
          ))}
          <Link
            href="/orders?late=true"
            className="card-levitate rounded-2xl bg-white dark:bg-slate-900 p-4 text-center border border-gray-100 dark:border-slate-800 shadow-sm cursor-pointer group hover:bg-gradient-to-b hover:from-white hover:to-red-50/10 dark:hover:to-red-950/20 hover:shadow-red-500/10 hover:border-red-200 dark:hover:border-red-800 col-span-2 sm:col-span-1 transition-all hover:scale-[1.03] active:scale-[0.97] block"
            title="Afficher les commandes en retard de livraison"
          >
            <div className="w-10 h-10 bg-red-50 dark:bg-red-950/40 rounded-xl flex items-center justify-center mx-auto mb-2 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md">
              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400" />
            </div>
            <p className="text-2xl font-black text-red-600 dark:text-red-400">
              <AnimatedNumber value={data.lateOrders} formatAsFCFA={false} />
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 font-semibold flex items-center justify-center gap-1">
              <span>En retard</span>
              <span className="text-red-300 dark:text-red-600 group-hover:text-red-600 dark:group-hover:text-red-400 text-[10px] transition-colors">→</span>
            </p>
          </Link>
        </div>

        {/* 2026 Modern Spline Interactive Chart */}
        <ModernAreaChart
          dailyRevenue={data.weeklyDailyRevenue || []}
          dailyOrders={data.weeklyDailyOrders || []}
        />

        {/* Section Propriétaire : Top 5 Services du Mois & Paiements du Jour (100% Mobile Responsive) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Top 5 Services & Articles les plus vendus du mois */}
          <div className="card bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-primary-50 dark:bg-primary-950/60 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold shadow-xs">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-gray-900 dark:text-white">
                      Top Services & Articles
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      Prestations les plus rentables du mois
                    </p>
                  </div>
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/40">
                  Ce mois
                </span>
              </div>

              {!data.topServices || data.topServices.length === 0 ? (
                <div className="py-10 text-center text-xs text-gray-400 dark:text-slate-500">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-slate-600 opacity-60" />
                  <span>Aucun article déposé sur ce mois pour le moment</span>
                </div>
              ) : (
                <div className="space-y-3.5 my-2">
                  {data.topServices.map((service, idx) => {
                    const badgeStyles = [
                      "bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-300 border-amber-300/80",
                      "bg-slate-200/80 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300",
                      "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 border-amber-200",
                      "bg-gray-100 dark:bg-slate-800/60 text-gray-700 dark:text-slate-400 border-gray-200 dark:border-slate-700",
                      "bg-gray-100 dark:bg-slate-800/60 text-gray-700 dark:text-slate-400 border-gray-200 dark:border-slate-700",
                    ];
                    return (
                      <div key={service.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`w-5 h-5 rounded-md flex items-center justify-center font-black text-[10px] border shrink-0 ${
                                badgeStyles[idx] || badgeStyles[4]
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <span className="font-bold text-gray-900 dark:text-white truncate">
                              {service.name}
                            </span>
                            <span className="text-[11px] text-gray-400 dark:text-slate-500 shrink-0">
                              ({service.quantity} pièce{service.quantity > 1 ? "s" : ""})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-bold text-gray-900 dark:text-white">
                              {formatFCFA(service.total)}
                            </span>
                            <span className="text-[10px] font-extrabold text-primary-600 dark:text-primary-400 min-w-[32px] text-right">
                              {service.percentage}%
                            </span>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.max(6, service.percentage)}%` }}
                            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-500"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between text-xs text-gray-500 dark:text-slate-400">
              <span>Basé sur les commandes enregistrées</span>
              <Link
                href="/orders"
                className="font-semibold text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                <span>Voir les commandes</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {/* 2026 Modern Donut Chart (Paiements du Jour) */}
          <ModernDonutChart
            title="Paiements du jour"
            subtitle="Répartition en temps réel par canal"
            segments={paymentSegments}
            totalLabel="Total Encaissé"
            emptyMessage="Aucun encaissement enregistré aujourd'hui"
          />
        </div>

        {/* Centre d'Action : Urgences et Livraisons du Jour */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Urgent Orders (Retards) */}
          <div className="card flex flex-col bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">En retard</h2>
              </div>
              <Link href="/orders?status=TRAITEMENT" className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline">
                Voir tout
              </Link>
            </div>
            
            {data.urgentOrders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                <CheckCircle2 className="w-10 h-10 text-gray-300 dark:text-slate-600 mb-2" />
                <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Aucun retard !</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">L&apos;équipe est à jour.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.urgentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-red-100/60 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/20 hover:bg-red-50/40 dark:hover:bg-red-950/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/orders/${order.id}`} className="font-bold text-sm text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">
                          {order.code}
                        </Link>
                        <span className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${getStatusBadgeClass(order.status)}`}>
                          {order.status === "TRAITEMENT" ? "À FAIRE" : order.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-300 font-medium">{order.customer.name}</p>
                      <p className="text-xs text-red-500 dark:text-red-400 font-medium mt-1">
                        Promis le: {new Date(order.promisedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                    <Link
                      href={`/orders/${order.id}`}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-700 hover:shadow-sm"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Today's actions (Livrables ou Prêts) */}
          <div className="card flex flex-col bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">À livrer aujourd&apos;hui</h2>
              </div>
              <Link href="/orders?status=PRET" className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:underline">
                Voir tout
              </Link>
            </div>

            {data.todaysOrders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 dark:bg-slate-800/30 rounded-xl border border-dashed border-gray-200 dark:border-slate-800">
                <Package className="w-10 h-10 text-gray-300 dark:text-slate-600 mb-2" />
                <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Rien de prévu pour aujourd&apos;hui</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.todaysOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-emerald-100/60 dark:border-emerald-900/40 bg-emerald-50/20 dark:bg-emerald-950/20 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/40 transition-colors">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Link href={`/orders/${order.id}`} className="font-bold text-sm text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">
                          {order.code}
                        </Link>
                        <span className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${getStatusBadgeClass(order.status)}`}>
                          {order.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-slate-300 font-medium">{order.customer.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {order.status === 'PRET' && order.customer.phone && (
                        <button
                          onClick={() => openWhatsApp(order.customer.phone, order.customer.name, order.code)}
                          className="p-2 text-emerald-600 hover:text-emerald-700 bg-emerald-100/50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 rounded-lg transition-colors border border-transparent"
                          title="Relancer sur WhatsApp"
                        >
                          <MessageCircle className="w-4 h-4" />
                        </button>
                      )}
                      <Link
                        href={`/orders/${order.id}`}
                        className="p-2 text-gray-400 hover:text-primary-600 bg-white dark:bg-slate-800 rounded-lg transition-colors border border-gray-100 dark:border-slate-700 hover:border-gray-200 dark:hover:border-slate-600 shadow-sm"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {isScannerOpen && (
          <QrScannerModal
            onClose={() => setIsScannerOpen(false)}
            onScan={handleScan}
          />
        )}
      </div>
    </PullToRefresh>
  );
}
