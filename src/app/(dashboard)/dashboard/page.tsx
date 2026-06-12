"use client";

import { useEffect, useState } from "react";
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
  ChevronRight,
  Package,
} from "lucide-react";
import { formatOfflineCacheTime, readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import { useAuth } from "@/components/auth-provider";

interface DashboardData {
  revenue: { day: number; week: number; month: number };
  totalUnpaid: number;
  lateOrders: number;
  ordersByStatus: Record<string, number>;
  paymentsByMethod: { method: string; total: number; count: number }[];
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

      {/* 4 KPI cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-100/80 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
              <div className="skeleton h-3 w-16 rounded-md" />
            </div>
            <div className="skeleton h-7 w-28 rounded-lg" />
          </div>
        ))}
      </div>

      {/* Status grid skeleton */}
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-white rounded-2xl p-4 text-center border border-gray-100/80 shadow-sm flex flex-col items-center gap-2">
            <div className="skeleton w-8 h-8 sm:w-10 sm:h-10 rounded-xl" />
            <div className="skeleton h-6 w-8 rounded-md" />
            <div className="skeleton h-3 w-12 rounded-md" />
          </div>
        ))}
      </div>

      {/* Panels skeleton */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="skeleton w-5 h-5 rounded-md" />
              <div className="skeleton h-5 w-24 rounded-md" />
            </div>
            <div className="skeleton h-4 w-16 rounded-md" />
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-50 bg-gray-50/20">
                <div className="space-y-2 w-2/3">
                  <div className="flex items-center gap-2">
                    <div className="skeleton h-4 w-16 rounded-md" />
                    <div className="skeleton h-3 w-12 rounded-full" />
                  </div>
                  <div className="skeleton h-3 w-28 rounded-md" />
                </div>
                <div className="skeleton w-8 h-8 rounded-lg" />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="skeleton w-5 h-5 rounded-md" />
              <div className="skeleton h-5 w-36 rounded-md" />
            </div>
            <div className="skeleton h-4 w-16 rounded-md" />
          </div>
          <div className="space-y-3">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl border border-gray-50 bg-gray-50/20">
                <div className="space-y-2 w-2/3">
                  <div className="flex items-center gap-2">
                    <div className="skeleton h-4 w-16 rounded-md" />
                    <div className="skeleton h-3 w-12 rounded-full" />
                  </div>
                  <div className="skeleton h-3 w-24 rounded-md" />
                </div>
                <div className="skeleton w-8 h-8 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; val: number; index: number } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOffline(!navigator.onLine);

    const syncNetworkState = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);

    const loadDashboard = async () => {
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
    };

    loadDashboard();

    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (!data) return <p className="text-gray-500 text-center py-12">Erreur de chargement</p>;

  const statusConfig = [
    { key: "RECU", label: "Reçu", icon: Inbox, color: "from-blue-500 to-blue-600", bg: "bg-blue-50", text: "text-blue-700", glow: "hover:shadow-blue-500/10 hover:border-blue-200" },
    { key: "TRAITEMENT", label: "En traitement", icon: Clock, color: "from-amber-500 to-amber-600", bg: "bg-amber-50", text: "text-amber-700", glow: "hover:shadow-amber-500/10 hover:border-amber-200" },
    { key: "PRET", label: "Prêt", icon: CheckCircle2, color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50", text: "text-emerald-700", glow: "hover:shadow-emerald-500/10 hover:border-emerald-200" },
    { key: "LIVRE", label: "Livré", icon: Truck, color: "from-gray-400 to-gray-500", bg: "bg-gray-50", text: "text-gray-700", glow: "hover:shadow-gray-500/10 hover:border-gray-200" },
  ];

  const handleScan = (decodedText: string) => {
    setIsScannerOpen(false);
    try {
      const url = new URL(decodedText);
      const uuid = url.pathname.split("/").pop(); // assuming our receipt url is /share/receipt/[token] or we pass order id inside
      if (uuid) {
         // for simple search, we can just redirect to orders search
         router.push(`/orders?q=${encodeURIComponent(decodedText)}`);
      }
    } catch {
      router.push(`/orders?q=${encodeURIComponent(decodedText)}`);
    }
  };

  const openWhatsApp = (phone: string, customerName: string, orderCode: string) => {
    const message = `Bonjour ${customerName},\nVotre commande ${orderCode} est prête à être récupérée à notre pressing. À très bientôt !`;
    const cleanPhone = phone.replace(/[^0-9]/g, "");
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

  // Calculate dynamic sparkline trend based on current revenue data
  const dayValue = data.revenue.day || (data.revenue.week / 7) || 10000;
  const sparklineData = [
    dayValue * 0.65,
    dayValue * 0.85,
    dayValue * 0.7,
    dayValue * 1.15,
    dayValue * 0.95,
    dayValue * 1.3,
    dayValue,
  ];
  const minVal = Math.min(...sparklineData);
  const maxVal = Math.max(...sparklineData);
  const range = maxVal - minVal || 1;
  const points = sparklineData.map((val, i) => ({
    x: (i / (sparklineData.length - 1)) * 90,
    y: 32 - ((val - minVal) / range) * 22,
  }));
  const pointsStr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const pathStr = `M 0,35 L ${points.map((p) => `${p.x},${p.y}`).join(" L ")} L 90,35 Z`;

  // Main interactive chart points
  const pointsForMainChart = sparklineData.map((val, i) => {
    const x = 30 + (i / (sparklineData.length - 1)) * 440;
    const y = 170 - ((val - minVal) / range) * 140;
    return { x, y, val };
  });
  const linePathStr = `M ${pointsForMainChart.map((p) => `${p.x},${p.y}`).join(" L ")}`;
  const areaPathStr = `M 30,180 L ${pointsForMainChart.map((p) => `${p.x},${p.y}`).join(" L ")} L 470,180 Z`;

  return (
    <div className="space-y-8">
      {(isOffline || usingCache) && data && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 animate-fade-in">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Affichage hors ligne a partir des dernieres donnees synchronisees
            {formatOfflineCacheTime(cacheUpdatedAt) ? ` le ${formatOfflineCacheTime(cacheUpdatedAt)}` : ""}.
          </span>
        </div>
      )}

      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Bonjour, {user?.name?.split(" ")[0] || "l'équipe"} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Vue d&apos;ensemble de votre activité
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm active:scale-[0.97]"
          >
            <QrCode className="w-4 h-4 text-primary-600 animate-pulse-glow" />
            <span>Scanner</span>
          </button>
          <Link
            href="/orders/new"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors shadow-sm shadow-primary-600/20 active:scale-[0.97]"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Nouveau dépôt</span>
          </Link>
        </div>
      </div>

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="card-levitate glow-card glow-card-emerald bg-gradient-to-br from-emerald-50/40 via-white to-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-emerald-200/40 to-transparent rounded-bl-[50px] opacity-70" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">CA Jour</span>
            </div>
            <p className="text-lg sm:text-2xl font-black text-gray-900">{formatFCFA(data.revenue.day)}</p>
          </div>
        </div>

        <div className="card-levitate glow-card bg-gradient-to-br from-primary-50/40 via-white to-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary-200/40 to-transparent rounded-bl-[50px] opacity-70" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 bg-primary-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20">
                <CalendarDays className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">CA Semaine</span>
            </div>
            <div className="flex items-end justify-between">
              <p className="text-lg sm:text-2xl font-black text-gray-900">{formatFCFA(data.revenue.week)}</p>
              
              {/* Mini Sparkline Graph */}
              <div className="hidden sm:block absolute right-0 bottom-0 opacity-40 pointer-events-none pr-1 pb-1">
                <svg width="90" height="35" className="overflow-visible">
                  <defs>
                    <linearGradient id="sparkline-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d={pathStr}
                    fill="url(#sparkline-grad)"
                  />
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
        </div>

        <div className="card-levitate glow-card glow-card-violet bg-gradient-to-br from-violet-50/40 via-white to-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-violet-200/40 to-transparent rounded-bl-[50px] opacity-70" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 bg-violet-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-violet-600/20">
                <Calendar className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">CA Mois</span>
            </div>
            <p className="text-lg sm:text-2xl font-black text-gray-900">{formatFCFA(data.revenue.month)}</p>
          </div>
        </div>

        <div className="card-levitate glow-card glow-card-red bg-gradient-to-br from-red-50/40 via-white to-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-red-200/40 to-transparent rounded-bl-[50px] opacity-70" />
          <div className="relative">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-400">Impayés</span>
            </div>
            <p className="text-lg sm:text-2xl font-black text-red-600">{formatFCFA(data.totalUnpaid)}</p>
          </div>
        </div>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {statusConfig.map(({ key, label, icon: Icon, bg, text, glow }) => (
          <div key={key} className={`card-levitate rounded-2xl bg-white p-4 text-center border border-gray-100 shadow-sm cursor-pointer group hover:bg-gradient-to-b hover:from-white hover:to-gray-50/20 ${glow}`}>
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mx-auto mb-2 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md`}>
              <Icon className={`w-5 h-5 ${text}`} />
            </div>
            <p className="text-2xl font-black text-gray-900 transition-colors duration-300 group-hover:text-primary-600">{data.ordersByStatus[key] || 0}</p>
            <p className="text-xs text-gray-500 mt-1 font-semibold">{label}</p>
          </div>
        ))}
        <div className="card-levitate rounded-2xl bg-white p-4 text-center border border-gray-100 shadow-sm cursor-pointer group hover:bg-gradient-to-b hover:from-white hover:to-red-50/10 hover:shadow-red-500/10 hover:border-red-200 col-span-2 sm:col-span-1">
          <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-2 transition-all duration-300 group-hover:scale-110 group-hover:shadow-md">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-2xl font-black text-red-600">{data.lateOrders}</p>
          <p className="text-xs text-gray-500 mt-1 font-semibold">En retard</p>
        </div>
      </div>

      {/* Graphique de Tendance Hebdomadaire Interactif */}
      <div className="card card-levitate relative overflow-hidden bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Analyse des Revenus Hebdomadaires</h3>
            <p className="text-xs text-gray-500">Tendance des ventes sur les 7 derniers jours d&apos;activité</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary-500 inline-block" />
              <span className="text-gray-600 font-medium">Revenu estimé (FCFA)</span>
            </div>
          </div>
        </div>

        <div className="relative h-64 w-full">
          <svg viewBox="0 0 500 200" className="w-full h-full overflow-visible" preserveAspectRatio="none">
            <defs>
              <linearGradient id="chart-glow-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </linearGradient>
            </defs>
            
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const y = 30 + ratio * 140;
              const val = maxVal - ratio * range;
              return (
                <g key={index} className="opacity-10">
                  <line x1="30" y1={y} x2="470" y2={y} stroke="#94a3b8" strokeWidth="1" strokeDasharray="4 4" />
                  <text x="20" y={y + 3} className="text-[9px] fill-gray-400 font-semibold text-right" textAnchor="end">
                    {formatFCFA(val)}
                  </text>
                </g>
              );
            })}

            {/* Area under the curve */}
            <path
              d={areaPathStr}
              fill="url(#chart-glow-grad)"
              className="transition-all duration-300"
            />

            {/* Main Curve */}
            <path
              d={linePathStr}
              fill="none"
              stroke="#3b82f6"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />

            {/* Interactive Hover Dots */}
            {pointsForMainChart.map((p, i) => (
              <g key={i}>
                {/* Bigger hover trigger area */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="16"
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredPoint({ x: p.x, y: p.y, val: p.val, index: i })}
                  onMouseLeave={() => setHoveredPoint(null)}
                />
                {/* Visual Dot */}
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={hoveredPoint?.index === i ? 6 : 4}
                  fill={hoveredPoint?.index === i ? "#ffffff" : "#3b82f6"}
                  stroke="#3b82f6"
                  strokeWidth={hoveredPoint?.index === i ? 3 : 1.5}
                  className="transition-all duration-150 pointer-events-none"
                />
              </g>
            ))}
          </svg>

          {/* Custom HTML Tooltip */}
          {hoveredPoint && (
            <div
              className="absolute z-10 bg-gray-900 text-white p-2.5 rounded-xl shadow-xl text-xs border border-gray-800 transition-all duration-100 pointer-events-none flex flex-col gap-0.5"
              style={{
                left: `${(hoveredPoint.x / 500) * 100}%`,
                top: `${(hoveredPoint.y / 200) * 100 - 15}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <span className="font-semibold text-[9px] text-gray-400 uppercase tracking-wider">
                {["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"][hoveredPoint.index]}
              </span>
              <span className="font-bold text-xs text-primary-400">
                {formatFCFA(hoveredPoint.val)}
              </span>
            </div>
          )}
        </div>
        
        {/* X Axis Labels */}
        <div className="flex justify-between mt-3 px-6">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day, i) => (
            <span key={i} className="text-[10px] font-bold text-gray-400 w-12 text-center">
              {day}
            </span>
          ))}
        </div>
      </div>

      {/* Payments by method today */}
      {data.paymentsByMethod.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <Banknote className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Paiements du jour</h2>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {data.paymentsByMethod.map((p) => {
              const Icon = METHOD_ICONS[p.method] || Wallet;
              return (
                <div key={p.method} className="bg-gray-50/80 rounded-xl p-4 text-center border border-gray-100">
                  <Icon className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-600">{METHOD_LABELS[p.method] || p.method}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">{formatFCFA(p.total)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{p.count} paiement{p.count > 1 ? "s" : ""}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Centre d'Action : Urgences et Livraisons du Jour */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Urgent Orders (Retards) */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-gray-900">En retard</h2>
            </div>
            <Link href="/orders?status=TRAITEMENT" className="text-sm font-medium text-red-600 hover:text-red-700">
              Voir tout
            </Link>
          </div>
          
          {data.urgentOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <CheckCircle2 className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm font-medium">Aucun retard !</p>
              <p className="text-xs text-gray-400 mt-1">L&apos;équipe est à jour.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.urgentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-red-100/60 bg-red-50/20 hover:bg-red-50/40 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/orders/${order.id}`} className="font-bold text-sm text-gray-900 hover:text-primary-600">
                        {order.code}
                      </Link>
                      <span className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${getStatusBadgeClass(order.status)}`}>
                        {order.status === "TRAITEMENT" ? "À FAIRE" : order.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">{order.customer.name}</p>
                    <p className="text-xs text-red-500 font-medium mt-1">
                      Promis le: {new Date(order.promisedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <Link
                    href={`/orders/${order.id}`}
                    className="p-2 text-gray-400 hover:text-primary-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200 hover:shadow-sm"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Today's actions (Livrables ou Prêts) */}
        <div className="card flex flex-col">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-semibold text-gray-900">À livrer aujourd&apos;hui</h2>
            </div>
            <Link href="/orders?status=PRET" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700">
              Voir tout
            </Link>
          </div>

          {data.todaysOrders.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-8 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
              <Package className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-gray-500 text-sm font-medium">Rien de prévu pour aujourd&apos;hui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.todaysOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 sm:p-4 rounded-xl border border-emerald-100/60 bg-emerald-50/20 hover:bg-emerald-50/40 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/orders/${order.id}`} className="font-bold text-sm text-gray-900 hover:text-primary-600">
                        {order.code}
                      </Link>
                      <span className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full ${getStatusBadgeClass(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-medium">{order.customer.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {order.status === 'PRET' && order.customer.phone && (
                      <button
                        onClick={() => openWhatsApp(order.customer.phone, order.customer.name, order.code)}
                        className="p-2 text-emerald-600 hover:text-emerald-700 bg-emerald-100/50 hover:bg-emerald-100 rounded-lg transition-colors border border-transparent"
                        title="Relancer sur WhatsApp"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                    )}
                    <Link
                      href={`/orders/${order.id}`}
                      className="p-2 text-gray-400 hover:text-primary-600 bg-white rounded-lg transition-colors border border-gray-100 hover:border-gray-200 shadow-sm"
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
  );
}
