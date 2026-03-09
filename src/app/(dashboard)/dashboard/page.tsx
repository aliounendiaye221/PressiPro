"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  CalendarDays,
  Calendar,
  AlertTriangle,
  Banknote,
  Clock,
  Package,
  CheckCircle2,
  Truck,
  Inbox,
  CreditCard,
  Smartphone,
  Wallet,
  ArrowUpRight,
  WifiOff,
} from "lucide-react";
import { formatOfflineCacheTime, readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";

interface DashboardData {
  revenue: { day: number; week: number; month: number };
  totalUnpaid: number;
  lateOrders: number;
  ordersByStatus: Record<string, number>;
  paymentsByMethod: { method: string; total: number; count: number }[];
  recentPayments: {
    id: string;
    amount: number;
    method: string;
    orderCode: string;
    customerName: string;
    createdAt: string;
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
          <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!data) return <p className="text-gray-500 text-center py-12">Erreur de chargement</p>;

  const statusConfig = [
    { key: "RECU", label: "Reçu", icon: Inbox, color: "from-blue-500 to-blue-600", bg: "bg-blue-50", text: "text-blue-700" },
    { key: "TRAITEMENT", label: "En traitement", icon: Clock, color: "from-amber-500 to-amber-600", bg: "bg-amber-50", text: "text-amber-700" },
    { key: "PRET", label: "Prêt", icon: CheckCircle2, color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50", text: "text-emerald-700" },
    { key: "LIVRE", label: "Livré", icon: Truck, color: "from-gray-400 to-gray-500", bg: "bg-gray-50", text: "text-gray-700" },
  ];

  return (
    <div className="space-y-8">
      {(isOffline || usingCache) && data && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Affichage hors ligne a partir des dernieres donnees synchronisees
            {formatOfflineCacheTime(cacheUpdatedAt) ? ` le ${formatOfflineCacheTime(cacheUpdatedAt)}` : ""}.
          </span>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="text-sm text-gray-500 mt-1">
          Vue d&apos;ensemble de votre activité
        </p>
      </div>

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="stat-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-emerald-100 to-transparent rounded-bl-[40px] opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-emerald-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-[18px] h-[18px] text-emerald-600" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">CA Jour</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">{formatFCFA(data.revenue.day)}</p>
          </div>
        </div>

        <div className="stat-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-primary-100 to-transparent rounded-bl-[40px] opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-primary-100 rounded-xl flex items-center justify-center">
                <CalendarDays className="w-[18px] h-[18px] text-primary-600" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">CA Semaine</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">{formatFCFA(data.revenue.week)}</p>
          </div>
        </div>

        <div className="stat-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-violet-100 to-transparent rounded-bl-[40px] opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
                <Calendar className="w-[18px] h-[18px] text-violet-600" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">CA Mois</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">{formatFCFA(data.revenue.month)}</p>
          </div>
        </div>

        <div className="stat-card relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-red-100 to-transparent rounded-bl-[40px] opacity-60" />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-[18px] h-[18px] text-red-500" />
              </div>
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-400">Impayés</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-red-600">{formatFCFA(data.totalUnpaid)}</p>
          </div>
        </div>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        {statusConfig.map(({ key, label, icon: Icon, bg, text }) => (
          <div key={key} className="stat-card text-center">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 ${bg} rounded-xl flex items-center justify-center mx-auto mb-1 sm:mb-2`}>
              <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${text}`} />
            </div>
            <p className="text-xl sm:text-3xl font-bold text-gray-900">{data.ordersByStatus[key] || 0}</p>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
        <div className="stat-card text-center">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-1 sm:mb-2">
            <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
          </div>
          <p className="text-xl sm:text-3xl font-bold text-red-600">{data.lateOrders}</p>
          <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">En retard</p>
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

      {/* Recent payments */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <ArrowUpRight className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-semibold text-gray-900">Derniers paiements</h2>
        </div>
        {data.recentPayments.length === 0 ? (
          <div className="text-center py-8">
            <Banknote className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Aucun paiement récent</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-6">
            <table className="min-w-[560px] w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="py-3 px-6 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Commande</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Client</th>
                  <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Montant</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Méthode</th>
                  <th className="py-3 px-6 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.recentPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 px-6">
                      <span className="font-mono font-bold text-sm text-primary-700">{p.orderCode}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700">{p.customerName}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-sm font-semibold text-gray-900">{formatFCFA(p.amount)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="badge bg-gray-100 text-gray-600">{METHOD_LABELS[p.method] || p.method}</span>
                    </td>
                    <td className="py-3 px-6 text-right text-sm text-gray-400">
                      {new Date(p.createdAt).toLocaleString("fr-SN", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
