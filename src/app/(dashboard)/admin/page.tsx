"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import {
  Building2, Users, ShoppingCart, TrendingUp, TrendingDown,
  CreditCard, Banknote, Smartphone, Wallet, UserCheck,
  ArrowUpRight, CalendarDays, Activity, Globe, Shield,
  ChevronRight, DollarSign, Search, ChevronLeft,
  Package, Eye, Phone, Mail, MapPin, BarChart3,
  Filter, RefreshCw, Hash, Trash2, Power, Crown,
} from "lucide-react";

/* ─── Types ─── */

interface KPI {
  totalTenants: number;
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  totalCustomers: number;
  mrr: number;
  mrrGrowth: number;
  totalRevenue: number;
  avgOrderValue: number;
  ordersThisMonth: number;
  ordersPrevMonth: number;
}

interface OrdersByStatus {
  RECU: number;
  TRAITEMENT: number;
  PRET: number;
  LIVRE: number;
}

interface DailyRevenue {
  date: string;
  amount: number;
}

interface PaymentByMethod {
  method: string;
  total: number;
  count: number;
}

interface TenantStat {
  id: string;
  name: string;
  phone: string | null;
  active: boolean;
  subscription: string;
  createdAt: string;
  users: number;
  orders: number;
  customers: number;
  revenue: number;
  totalRevenue: number;
}

interface RecentPayment {
  id: string;
  amount: number;
  method: string;
  orderCode: string;
  customerName: string;
  tenantName: string;
  createdAt: string;
}

interface StatsData {
  kpi: KPI;
  ordersByStatus: OrdersByStatus;
  dailyRevenue: DailyRevenue[];
  tenants: TenantStat[];
  recentPayments: RecentPayment[];
  paymentsByMethod: PaymentByMethod[];
}

interface AdminCustomer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  tenantId: string;
  tenantName: string;
  orders: number;
  createdAt: string;
}

interface AdminOrder {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  customerName: string;
  customerPhone: string;
  tenantId: string;
  tenantName: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  payments: { amount: number; method: string; createdAt: string }[];
  createdAt: string;
  promisedAt: string | null;
}

/* ─── Helpers ─── */

function formatFCFA(n: number) {
  return new Intl.NumberFormat("fr-SN").format(n) + " F";
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("fr-SN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(d: string) {
  return new Date(d).toLocaleDateString("fr-SN", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

const METHOD_ICONS: Record<string, React.ReactNode> = {
  CASH: <Banknote className="w-4 h-4" />,
  OM: <Smartphone className="w-4 h-4 text-orange-500" />,
  WAVE: <CreditCard className="w-4 h-4 text-blue-500" />,
  OTHER: <Wallet className="w-4 h-4" />,
};

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  OM: "Orange Money",
  WAVE: "Wave",
  OTHER: "Autre",
};

const METHOD_COLORS: Record<string, string> = {
  CASH: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  OM: "bg-orange-50 text-orange-700 ring-orange-600/10",
  WAVE: "bg-blue-50 text-blue-700 ring-blue-600/10",
  OTHER: "bg-gray-50 text-gray-700 ring-gray-600/10",
};

const STATUS_LABELS: Record<string, string> = {
  RECU: "Reçu",
  TRAITEMENT: "Traitement",
  PRET: "Prêt",
  LIVRE: "Livré",
};

const STATUS_COLORS: Record<string, string> = {
  RECU: "bg-blue-50 text-blue-700 ring-blue-600/10",
  TRAITEMENT: "bg-amber-50 text-amber-700 ring-amber-600/10",
  PRET: "bg-purple-50 text-purple-700 ring-purple-600/10",
  LIVRE: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
};

const SUB_COLORS: Record<string, string> = {
  FREE: "bg-gray-100 text-gray-600",
  BASIC: "bg-blue-100 text-blue-700",
  PRO: "bg-purple-100 text-purple-700",
  ENTERPRISE: "bg-amber-100 text-amber-800",
};

type Tab = "overview" | "customers" | "orders" | "billing" | "tenants";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Vue d'ensemble", icon: <BarChart3 className="w-4 h-4" /> },
  { key: "customers", label: "Clients", icon: <Users className="w-4 h-4" /> },
  { key: "orders", label: "Commandes", icon: <ShoppingCart className="w-4 h-4" /> },
  { key: "billing", label: "Facturation", icon: <DollarSign className="w-4 h-4" /> },
  { key: "tenants", label: "Pressings", icon: <Building2 className="w-4 h-4" /> },
];

/* ─── Component ─── */

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Customers state
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [customersPage, setCustomersPage] = useState(1);
  const [customersSearch, setCustomersSearch] = useState("");
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customersTenantFilter, setCustomersTenantFilter] = useState("");

  // Tenant management state
  const [tenantAction, setTenantAction] = useState<{ id: string; type: "delete" | "sub" | "toggle" } | null>(null);
  const [tenantActionLoading, setTenantActionLoading] = useState(false);
  const [selectedSub, setSelectedSub] = useState("");

  // Orders state
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [ordersStatusFilter, setOrdersStatusFilter] = useState("");
  const [ordersTenantFilter, setOrdersTenantFilter] = useState("");
  const [ordersLoading, setOrdersLoading] = useState(false);

  useEffect(() => {
    if (user && user.role !== "SUPER_ADMIN") {
      router.push("/dashboard");
      return;
    }
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then(setStatsData)
      .finally(() => setLoading(false));
  }, [user, router]);

  const fetchCustomers = useCallback(async (page = 1, search = "", tenantId = "") => {
    setCustomersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("q", search);
      if (tenantId) params.set("tenantId", tenantId);
      const res = await fetch(`/api/admin/customers?${params}`);
      const data = await res.json();
      setCustomers(data.customers || []);
      setCustomersTotal(data.total || 0);
      setCustomersPage(page);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async (page = 1, search = "", status = "", tenantId = "") => {
    setOrdersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("q", search);
      if (status) params.set("status", status);
      if (tenantId) params.set("tenantId", tenantId);
      const res = await fetch(`/api/admin/orders?${params}`);
      const data = await res.json();
      setOrders(data.orders || []);
      setOrdersTotal(data.total || 0);
      setOrdersPage(page);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const toggleTenantActive = async (tenantId: string, currentActive: boolean) => {
    setTenantActionLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !currentActive }),
      });
      if (res.ok) {
        setStatsData((prev) => prev ? {
          ...prev,
          tenants: prev.tenants.map((t) => t.id === tenantId ? { ...t, active: !currentActive } : t),
        } : prev);
      }
    } finally {
      setTenantActionLoading(false);
      setTenantAction(null);
    }
  };

  const updateTenantSubscription = async (tenantId: string, subscription: string) => {
    setTenantActionLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      });
      if (res.ok) {
        setStatsData((prev) => prev ? {
          ...prev,
          tenants: prev.tenants.map((t) => t.id === tenantId ? { ...t, subscription } : t),
        } : prev);
      }
    } finally {
      setTenantActionLoading(false);
      setTenantAction(null);
    }
  };

  const deleteTenant = async (tenantId: string) => {
    setTenantActionLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`, { method: "DELETE" });
      if (res.ok) {
        setStatsData((prev) => prev ? {
          ...prev,
          tenants: prev.tenants.filter((t) => t.id !== tenantId),
          kpi: { ...prev.kpi, totalTenants: prev.kpi.totalTenants - 1 },
        } : prev);
      }
    } finally {
      setTenantActionLoading(false);
      setTenantAction(null);
    }
  };

  // Load tab data when switching
  useEffect(() => {
    if (activeTab === "customers" && customers.length === 0 && !customersLoading) {
      fetchCustomers();
    }
    if (activeTab === "orders" && orders.length === 0 && !ordersLoading) {
      fetchOrders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
          <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!statsData) return <p className="text-center py-10 text-gray-500">Erreur de chargement</p>;

  const { kpi, tenants, recentPayments, paymentsByMethod, ordersByStatus, dailyRevenue } = statsData;
  const totalCustomersPages = Math.ceil(customersTotal / 20);
  const totalOrdersPages = Math.ceil(ordersTotal / 20);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-violet-500 to-violet-700 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25">
              <Shield className="w-4 h-4 sm:w-[18px] sm:h-[18px] text-white" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard Owner</h1>
          </div>
          <p className="text-sm text-gray-500 ml-[42px] sm:ml-[46px]">Gestion complète de la plateforme PressiPro</p>
        </div>
        <div className="flex items-center gap-2 ml-[42px] sm:ml-0">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full ring-1 ring-emerald-600/10">
            <Activity className="w-3 h-3" /> Plateforme active
          </span>
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-hide">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 min-w-max sm:min-w-0">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Tab Content ─── */}

      {/* ═══ OVERVIEW TAB ═══ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <KpiCard
              icon={<Building2 className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-white" />}
              value={String(kpi.totalTenants)}
              label="Pressings actifs"
              gradient="from-blue-500 to-blue-700"
              shadow="shadow-blue-500/20"
            />
            <KpiCard
              icon={<Users className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-white" />}
              value={String(kpi.totalUsers)}
              label="Utilisateurs"
              gradient="from-violet-500 to-violet-700"
              shadow="shadow-violet-500/20"
              sub={<><UserCheck className="w-3 h-3" /><span>{kpi.activeUsers} actifs</span></>}
            />
            <KpiCard
              icon={<ShoppingCart className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-white" />}
              value={String(kpi.totalOrders)}
              label="Commandes"
              gradient="from-amber-500 to-orange-600"
              shadow="shadow-amber-500/20"
              sub={<><Globe className="w-3 h-3" /><span>{kpi.totalCustomers} clients</span></>}
            />
            <KpiCard
              icon={<DollarSign className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-white" />}
              value={formatFCFA(kpi.mrr)}
              label="Revenu du mois"
              gradient="from-emerald-500 to-emerald-700"
              shadow="shadow-emerald-500/20"
              valueClass="text-xl sm:text-2xl"
              sub={
                <span className={kpi.mrrGrowth >= 0 ? "" : "text-red-200"}>
                  {kpi.mrrGrowth >= 0 ? <ArrowUpRight className="w-3 h-3 inline" /> : <TrendingDown className="w-3 h-3 inline" />}
                  {" "}{kpi.mrrGrowth > 0 ? "+" : ""}{kpi.mrrGrowth}% vs mois dernier
                </span>
              }
            />
          </div>

          {/* Status Distribution + Revenue Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Order Status Distribution */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4 text-primary-600" /> Répartition des commandes
              </h3>
              <div className="space-y-3">
                {(["RECU", "TRAITEMENT", "PRET", "LIVRE"] as const).map((status) => {
                  const count = ordersByStatus[status];
                  const pct = kpi.totalOrders > 0 ? Math.round((count / kpi.totalOrders) * 100) : 0;
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${STATUS_COLORS[status]}`}>
                          {STATUS_LABELS[status]}
                        </span>
                        <span className="text-sm font-semibold text-gray-700">{count} <span className="text-gray-400 font-normal text-xs">({pct}%)</span></span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            status === "RECU" ? "bg-blue-500" :
                            status === "TRAITEMENT" ? "bg-amber-500" :
                            status === "PRET" ? "bg-purple-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Stats Cards */}
            <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 sm:p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary-600" /> Métriques clés
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                  <p className="text-xs text-gray-500 mb-1">Revenu total</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900">{formatFCFA(kpi.totalRevenue)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                  <p className="text-xs text-gray-500 mb-1">Panier moyen</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900">{formatFCFA(kpi.avgOrderValue)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                  <p className="text-xs text-gray-500 mb-1">Cmd ce mois</p>
                  <p className="text-base sm:text-lg font-bold text-gray-900">{kpi.ordersThisMonth}</p>
                  {kpi.ordersPrevMonth > 0 && (
                    <p className={`text-[10px] mt-0.5 ${kpi.ordersThisMonth >= kpi.ordersPrevMonth ? "text-emerald-600" : "text-red-500"}`}>
                      {kpi.ordersThisMonth >= kpi.ordersPrevMonth ? "+" : ""}
                      {Math.round(((kpi.ordersThisMonth - kpi.ordersPrevMonth) / kpi.ordersPrevMonth) * 100)}% vs mois dernier
                    </p>
                  )}
                </div>
                <div className="bg-gray-50 rounded-xl p-3 sm:p-4">
                  <p className="text-xs text-gray-500 mb-1">Méthodes de paiement</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {paymentsByMethod.map((pm) => (
                      <span key={pm.method} className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ${METHOD_COLORS[pm.method]}`}>
                        {METHOD_LABELS[pm.method]}: {pm.count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue Trend (mini bar chart) */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 sm:p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Revenu des 30 derniers jours
            </h3>
            <div className="flex items-end gap-[2px] sm:gap-1 h-32 sm:h-40">
              {dailyRevenue.map((d) => {
                const max = Math.max(...dailyRevenue.map((x) => x.amount), 1);
                const heightPct = Math.max((d.amount / max) * 100, 2);
                return (
                  <div key={d.date} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                    <div
                      className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-sm sm:rounded-t transition-all hover:from-emerald-600 hover:to-emerald-500"
                      style={{ height: `${heightPct}%` }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                      {new Date(d.date).toLocaleDateString("fr-SN", { day: "2-digit", month: "short" })}: {formatFCFA(d.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>{new Date(dailyRevenue[0]?.date).toLocaleDateString("fr-SN", { day: "2-digit", month: "short" })}</span>
              <span>Aujourd&apos;hui</span>
            </div>
          </div>

          {/* Recent Payments */}
          <RecentPaymentsSection recentPayments={recentPayments} />
        </div>
      )}

      {/* ═══ CUSTOMERS TAB ═══ */}
      {activeTab === "customers" && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un client (nom, téléphone, email)..."
                value={customersSearch}
                onChange={(e) => setCustomersSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchCustomers(1, customersSearch, customersTenantFilter)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
              />
            </div>
            <select
              value={customersTenantFilter}
              onChange={(e) => {
                setCustomersTenantFilter(e.target.value);
                fetchCustomers(1, customersSearch, e.target.value);
              }}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Tous les pressings</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={() => fetchCustomers(1, customersSearch, customersTenantFilter)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Search className="w-4 h-4" /> Rechercher
            </button>
          </div>

          <div className="text-xs text-gray-500">{customersTotal} client{customersTotal > 1 ? "s" : ""} trouvé{customersTotal > 1 ? "s" : ""}</div>

          {customersLoading ? (
            <LoadingSpinner />
          ) : customers.length === 0 ? (
            <EmptyState icon={<Users className="w-10 h-10" />} text="Aucun client trouvé" />
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="sm:hidden space-y-3">
                {customers.map((c) => (
                  <div key={c.id} className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-primary-600 font-medium">{c.tenantName}</p>
                      </div>
                      <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold">{c.orders} cmd</span>
                    </div>
                    <div className="space-y-1.5 text-xs text-gray-500">
                      <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" /> {c.phone}</div>
                      {c.email && <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> {c.email}</div>}
                      {c.address && <div className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5" /> {c.address}</div>}
                    </div>
                    <div className="flex items-center justify-end mt-2 pt-2 border-t border-gray-50 text-[10px] text-gray-400">
                      <CalendarDays className="w-3 h-3 mr-1" /> {formatDate(c.createdAt)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Client</th>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pressing</th>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Téléphone</th>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                        <th className="py-3 px-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Commandes</th>
                        <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Inscription</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-primary-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">
                                {c.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{c.name}</p>
                                {c.address && <p className="text-xs text-gray-400 truncate max-w-[200px]">{c.address}</p>}
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-medium bg-gray-50 text-gray-700 px-2 py-1 rounded-lg">{c.tenantName}</span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 font-mono text-xs">{c.phone}</td>
                          <td className="py-3 px-4 text-gray-500 text-xs">{c.email || "—"}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-flex items-center justify-center min-w-[28px] h-7 bg-primary-50 text-primary-700 text-sm font-semibold rounded-lg">{c.orders}</span>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-400 text-xs">{formatDate(c.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <Pagination
                page={customersPage}
                totalPages={totalCustomersPages}
                onPageChange={(p) => fetchCustomers(p, customersSearch, customersTenantFilter)}
              />
            </>
          )}
        </div>
      )}

      {/* ═══ ORDERS TAB ═══ */}
      {activeTab === "orders" && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher (code, client)..."
                value={ordersSearch}
                onChange={(e) => setOrdersSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchOrders(1, ordersSearch, ordersStatusFilter, ordersTenantFilter)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
              />
            </div>
            <select
              value={ordersStatusFilter}
              onChange={(e) => {
                setOrdersStatusFilter(e.target.value);
                fetchOrders(1, ordersSearch, e.target.value, ordersTenantFilter);
              }}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Tous les statuts</option>
              <option value="RECU">Reçu</option>
              <option value="TRAITEMENT">Traitement</option>
              <option value="PRET">Prêt</option>
              <option value="LIVRE">Livré</option>
            </select>
            <select
              value={ordersTenantFilter}
              onChange={(e) => {
                setOrdersTenantFilter(e.target.value);
                fetchOrders(1, ordersSearch, ordersStatusFilter, e.target.value);
              }}
              className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            >
              <option value="">Tous les pressings</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              onClick={() => fetchOrders(1, ordersSearch, ordersStatusFilter, ordersTenantFilter)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium hover:bg-primary-700 transition-colors"
            >
              <Filter className="w-4 h-4" /> Filtrer
            </button>
          </div>

          <div className="text-xs text-gray-500">{ordersTotal} commande{ordersTotal > 1 ? "s" : ""} trouvée{ordersTotal > 1 ? "s" : ""}</div>

          {ordersLoading ? (
            <LoadingSpinner />
          ) : orders.length === 0 ? (
            <EmptyState icon={<ShoppingCart className="w-10 h-10" />} text="Aucune commande trouvée" />
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="sm:hidden space-y-3">
                {orders.map((o) => (
                  <div key={o.id} className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">{o.code}</span>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ring-1 ${STATUS_COLORS[o.status]}`}>
                          {STATUS_LABELS[o.status]}
                        </span>
                      </div>
                      <p className="text-base font-bold text-gray-900">{formatFCFA(o.totalAmount)}</p>
                    </div>
                    <div className="space-y-1 text-xs text-gray-600 mb-2">
                      <p className="font-medium">{o.customerName} <span className="text-gray-400">· {o.customerPhone}</span></p>
                      <p className="text-primary-600">{o.tenantName}</p>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      {o.items.slice(0, 3).map((item, i) => (
                        <span key={i} className="text-[10px] bg-gray-50 px-1.5 py-0.5 rounded text-gray-600">{item.name} ×{item.quantity}</span>
                      ))}
                      {o.items.length > 3 && <span className="text-[10px] text-gray-400">+{o.items.length - 3}</span>}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-50">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-medium ${o.paidAmount >= o.totalAmount ? "text-emerald-600" : "text-amber-600"}`}>
                          {o.paidAmount >= o.totalAmount ? "Payé" : `${formatFCFA(o.paidAmount)} payé`}
                        </span>
                      </div>
                      <span className="text-[10px] text-gray-400">{formatDateTime(o.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50/50">
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Code</th>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Client</th>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pressing</th>
                        <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Articles</th>
                        <th className="py-3 px-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Statut</th>
                        <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Total</th>
                        <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Payé</th>
                        <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-primary-50/30 transition-colors">
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">{o.code}</span>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium text-gray-900">{o.customerName}</p>
                            <p className="text-xs text-gray-400">{o.customerPhone}</p>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs font-medium bg-gray-50 text-gray-700 px-2 py-1 rounded-lg">{o.tenantName}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {o.items.slice(0, 2).map((item, i) => (
                                <span key={i} className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{item.name} ×{item.quantity}</span>
                              ))}
                              {o.items.length > 2 && <span className="text-[10px] text-gray-400">+{o.items.length - 2}</span>}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${STATUS_COLORS[o.status]}`}>
                              {STATUS_LABELS[o.status]}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-semibold text-gray-900">{formatFCFA(o.totalAmount)}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-medium ${o.paidAmount >= o.totalAmount ? "text-emerald-600" : "text-amber-600"}`}>
                              {formatFCFA(o.paidAmount)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-400 text-xs">{formatDate(o.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <Pagination
                page={ordersPage}
                totalPages={totalOrdersPages}
                onPageChange={(p) => fetchOrders(p, ordersSearch, ordersStatusFilter, ordersTenantFilter)}
              />
            </>
          )}
        </div>
      )}

      {/* ═══ BILLING TAB ═══ */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {/* Billing KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">Revenu total</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{formatFCFA(kpi.totalRevenue)}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">Revenu du mois</p>
              <p className="text-lg sm:text-xl font-bold text-emerald-700">{formatFCFA(kpi.mrr)}</p>
              <p className={`text-[10px] mt-0.5 ${kpi.mrrGrowth >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {kpi.mrrGrowth > 0 ? "+" : ""}{kpi.mrrGrowth}% vs mois dernier
              </p>
            </div>
            <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">Panier moyen</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{formatFCFA(kpi.avgOrderValue)}</p>
            </div>
            <div className="rounded-xl bg-white border border-gray-100 shadow-sm p-4">
              <p className="text-xs text-gray-500 mb-1">Commandes ce mois</p>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{kpi.ordersThisMonth}</p>
            </div>
          </div>

          {/* Payment Methods Breakdown */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 sm:p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary-600" /> Répartition par méthode de paiement (ce mois)
            </h3>
            {paymentsByMethod.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Aucun paiement ce mois</p>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const totalMethodAmount = paymentsByMethod.reduce((s, p) => s + p.total, 0);
                  return paymentsByMethod.map((pm) => {
                    const pct = totalMethodAmount > 0 ? Math.round((pm.total / totalMethodAmount) * 100) : 0;
                    return (
                      <div key={pm.method}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`inline-flex items-center gap-2 text-sm font-medium px-2.5 py-1 rounded-lg ring-1 ${METHOD_COLORS[pm.method]}`}>
                            {METHOD_ICONS[pm.method]} {METHOD_LABELS[pm.method] || pm.method}
                          </span>
                          <div className="text-right">
                            <span className="text-sm font-bold text-gray-900">{formatFCFA(pm.total)}</span>
                            <span className="text-xs text-gray-400 ml-2">({pm.count} paiements · {pct}%)</span>
                          </div>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                          <div
                            className={`h-2.5 rounded-full transition-all ${
                              pm.method === "CASH" ? "bg-emerald-500" :
                              pm.method === "OM" ? "bg-orange-500" :
                              pm.method === "WAVE" ? "bg-blue-500" : "bg-gray-500"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>

          {/* Revenue by Tenant */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary-600" /> Revenu par pressing
              </h3>
            </div>

            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gray-50">
              {tenants.map((t) => (
                <div key={t.id} className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.orders} commandes · {t.customers} clients</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-emerald-50/60 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">Ce mois</p>
                      <p className="text-sm font-bold text-emerald-700">{formatFCFA(t.revenue)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <p className="text-xs text-gray-500">Total</p>
                      <p className="text-sm font-bold text-gray-900">{formatFCFA(t.totalRevenue)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="py-3 px-6 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pressing</th>
                    <th className="py-3 px-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Commandes</th>
                    <th className="py-3 px-4 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Clients</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Revenu du mois</th>
                    <th className="py-3 px-6 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Revenu total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tenants.map((t) => (
                    <tr key={t.id} className="hover:bg-primary-50/30 transition-colors">
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm">
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{t.name}</p>
                            {t.phone && <p className="text-xs text-gray-400">{t.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 bg-amber-50 text-amber-700 text-sm font-semibold rounded-lg">{t.orders}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 bg-blue-50 text-blue-700 text-sm font-semibold rounded-lg">{t.customers}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-emerald-700">{formatFCFA(t.revenue)}</td>
                      <td className="py-3 px-6 text-right font-semibold text-gray-900">{formatFCFA(t.totalRevenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Daily Revenue Chart */}
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 sm:p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" /> Revenu des 30 derniers jours
            </h3>
            <div className="flex items-end gap-[2px] sm:gap-1 h-32 sm:h-40">
              {dailyRevenue.map((d) => {
                const max = Math.max(...dailyRevenue.map((x) => x.amount), 1);
                const heightPct = Math.max((d.amount / max) * 100, 2);
                return (
                  <div key={d.date} className="flex-1 group relative flex flex-col items-center justify-end h-full">
                    <div
                      className="w-full bg-gradient-to-t from-emerald-500 to-emerald-400 rounded-t-sm sm:rounded-t transition-all hover:from-emerald-600 hover:to-emerald-500"
                      style={{ height: `${heightPct}%` }}
                    />
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-10">
                      {new Date(d.date).toLocaleDateString("fr-SN", { day: "2-digit", month: "short" })}: {formatFCFA(d.amount)}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-gray-400">
              <span>{new Date(dailyRevenue[0]?.date).toLocaleDateString("fr-SN", { day: "2-digit", month: "short" })}</span>
              <span>Aujourd&apos;hui</span>
            </div>
          </div>

          {/* Recent Payments */}
          <RecentPaymentsSection recentPayments={recentPayments} />
        </div>
      )}

      {/* ═══ TENANTS TAB ═══ */}
      {activeTab === "tenants" && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-primary-50 rounded-lg flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-primary-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Gestion des pressings</h2>
                  <p className="text-xs text-gray-400 hidden sm:block">{tenants.length} pressing{tenants.length > 1 ? "s" : ""} — {tenants.filter((t) => t.active).length} actif{tenants.filter((t) => t.active).length > 1 ? "s" : ""}</p>
                </div>
              </div>
              <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">{tenants.length}</span>
            </div>

            {/* Action modal overlay */}
            {tenantAction && (() => {
              const t = tenants.find((x) => x.id === tenantAction.id);
              if (!t) return null;
              return (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !tenantActionLoading && setTenantAction(null)}>
                  <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                    {tenantAction.type === "delete" && (
                      <>
                        <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto">
                          <Trash2 className="w-6 h-6 text-red-600" />
                        </div>
                        <h3 className="text-center font-bold text-gray-900">Supprimer « {t.name} » ?</h3>
                        <p className="text-sm text-center text-gray-500">
                          Cette action supprimera définitivement le pressing et toutes ses données ({t.users} utilisateurs, {t.orders} commandes, {t.customers} clients).
                        </p>
                        <div className="flex gap-3">
                          <button className="btn-secondary flex-1" onClick={() => setTenantAction(null)} disabled={tenantActionLoading}>Annuler</button>
                          <button
                            className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-red-700 disabled:opacity-50 transition-colors text-sm"
                            onClick={() => deleteTenant(t.id)}
                            disabled={tenantActionLoading}
                          >
                            {tenantActionLoading ? "Suppression..." : "Supprimer"}
                          </button>
                        </div>
                      </>
                    )}
                    {tenantAction.type === "toggle" && (
                      <>
                        <div className={`w-12 h-12 ${t.active ? "bg-amber-50" : "bg-emerald-50"} rounded-xl flex items-center justify-center mx-auto`}>
                          <Power className={`w-6 h-6 ${t.active ? "text-amber-600" : "text-emerald-600"}`} />
                        </div>
                        <h3 className="text-center font-bold text-gray-900">{t.active ? "Désactiver" : "Réactiver"} « {t.name} » ?</h3>
                        <p className="text-sm text-center text-gray-500">
                          {t.active ? "Les utilisateurs ne pourront plus se connecter." : "Le pressing et ses utilisateurs seront réactivés."}
                        </p>
                        <div className="flex gap-3">
                          <button className="btn-secondary flex-1" onClick={() => setTenantAction(null)} disabled={tenantActionLoading}>Annuler</button>
                          <button
                            className={`flex-1 ${t.active ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"} text-white px-4 py-2.5 rounded-xl font-medium disabled:opacity-50 transition-colors text-sm`}
                            onClick={() => toggleTenantActive(t.id, t.active)}
                            disabled={tenantActionLoading}
                          >
                            {tenantActionLoading ? "..." : t.active ? "Désactiver" : "Réactiver"}
                          </button>
                        </div>
                      </>
                    )}
                    {tenantAction.type === "sub" && (
                      <>
                        <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mx-auto">
                          <Crown className="w-6 h-6 text-purple-600" />
                        </div>
                        <h3 className="text-center font-bold text-gray-900">Abonnement de « {t.name} »</h3>
                        <p className="text-sm text-center text-gray-500">Abonnement actuel : <span className="font-semibold">{t.subscription}</span></p>
                        <select
                          className="input-field w-full"
                          value={selectedSub || t.subscription}
                          onChange={(e) => setSelectedSub(e.target.value)}
                        >
                          <option value="FREE">Gratuit (FREE)</option>
                          <option value="BASIC">Basic</option>
                          <option value="PRO">Pro</option>
                          <option value="ENTERPRISE">Enterprise</option>
                        </select>
                        <div className="flex gap-3">
                          <button className="btn-secondary flex-1" onClick={() => setTenantAction(null)} disabled={tenantActionLoading}>Annuler</button>
                          <button
                            className="flex-1 bg-purple-600 text-white px-4 py-2.5 rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors text-sm"
                            onClick={() => updateTenantSubscription(t.id, selectedSub || t.subscription)}
                            disabled={tenantActionLoading}
                          >
                            {tenantActionLoading ? "..." : "Enregistrer"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gray-50">
              {tenants.map((t) => (
                <div key={t.id} className={`p-4 transition-colors ${!t.active ? "opacity-60 bg-gray-50/50" : "hover:bg-gray-50/50"}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 ${t.active ? "bg-gradient-to-br from-primary-400 to-primary-600" : "bg-gray-400"} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0`}>
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                        {!t.active && <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-medium">Inactif</span>}
                      </div>
                      {t.phone && <p className="text-xs text-gray-400">{t.phone}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SUB_COLORS[t.subscription] || "bg-gray-100 text-gray-600"}`}>{t.subscription}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${t.active ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{t.active ? "Actif" : "Inactif"}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-blue-50/60 rounded-lg px-2.5 py-2 text-center">
                      <p className="text-sm font-bold text-gray-900">{t.users}</p>
                      <p className="text-[10px] text-gray-500 font-medium">Users</p>
                    </div>
                    <div className="bg-amber-50/60 rounded-lg px-2.5 py-2 text-center">
                      <p className="text-sm font-bold text-gray-900">{t.orders}</p>
                      <p className="text-[10px] text-gray-500 font-medium">Cmd</p>
                    </div>
                    <div className="bg-emerald-50/60 rounded-lg px-2.5 py-2 text-center">
                      <p className="text-sm font-bold text-gray-900">{t.customers}</p>
                      <p className="text-[10px] text-gray-500 font-medium">Clients</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-sm font-semibold text-emerald-700">{formatFCFA(t.revenue)}</span>
                      <span className="text-xs text-gray-400 ml-1.5">/ mois</span>
                    </div>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> {formatDate(t.createdAt)}
                    </span>
                  </div>
                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => { setSelectedSub(t.subscription); setTenantAction({ id: t.id, type: "sub" }); }}
                      className="flex-1 text-xs bg-purple-50 text-purple-700 hover:bg-purple-100 px-2.5 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      <Crown className="w-3 h-3" /> Abonnement
                    </button>
                    <button
                      onClick={() => setTenantAction({ id: t.id, type: "toggle" })}
                      className={`flex-1 text-xs ${t.active ? "bg-amber-50 text-amber-700 hover:bg-amber-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"} px-2.5 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1`}
                    >
                      <Power className="w-3 h-3" /> {t.active ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      onClick={() => setTenantAction({ id: t.id, type: "delete" })}
                      className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-2 rounded-lg font-medium transition-colors flex items-center justify-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/50">
                    <th className="py-3 px-6 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pressing</th>
                    <th className="py-3 px-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Statut</th>
                    <th className="py-3 px-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Abonnement</th>
                    <th className="py-3 px-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Users</th>
                    <th className="py-3 px-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Cmd</th>
                    <th className="py-3 px-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Revenu</th>
                    <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tenants.map((t) => (
                    <tr key={t.id} className={`transition-colors group ${!t.active ? "opacity-60 bg-gray-50/30" : "hover:bg-primary-50/30"}`}>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 ${t.active ? "bg-gradient-to-br from-primary-400 to-primary-600" : "bg-gray-400"} rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm`}>
                            {t.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">{t.name}</p>
                            {t.phone && <p className="text-xs text-gray-400">{t.phone}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${t.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                          {t.active ? "Actif" : "Inactif"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SUB_COLORS[t.subscription] || "bg-gray-100 text-gray-600"}`}>
                          {t.subscription}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 bg-violet-50 text-violet-700 text-sm font-semibold rounded-lg">{t.users}</span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center justify-center min-w-[28px] h-7 bg-amber-50 text-amber-700 text-sm font-semibold rounded-lg">{t.orders}</span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div>
                          <span className="font-semibold text-emerald-700">{formatFCFA(t.revenue)}</span>
                          <p className="text-[10px] text-gray-400">{formatFCFA(t.totalRevenue)} total</p>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => { setSelectedSub(t.subscription); setTenantAction({ id: t.id, type: "sub" }); }}
                            className="p-1.5 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors" title="Abonnement"
                          >
                            <Crown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setTenantAction({ id: t.id, type: "toggle" })}
                            className={`p-1.5 rounded-lg ${t.active ? "bg-amber-50 text-amber-600 hover:bg-amber-100" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"} transition-colors`}
                            title={t.active ? "Désactiver" : "Activer"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setTenantAction({ id: t.id, type: "delete" })}
                            className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors" title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiCard({ icon, value, label, gradient, shadow, sub, valueClass }: {
  icon: React.ReactNode;
  value: string;
  label: string;
  gradient: string;
  shadow: string;
  sub?: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-4 sm:p-5 text-white shadow-lg ${shadow}`}>
      <div className="absolute -top-4 -right-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
      <div className="absolute bottom-0 right-0 w-16 h-16 bg-white/5 rounded-tl-3xl" />
      <div className="relative">
        <div className="w-9 h-9 sm:w-10 sm:h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3">
          {icon}
        </div>
        <p className={`font-bold ${valueClass || "text-2xl sm:text-3xl"}`}>{value}</p>
        <p className="text-xs sm:text-sm mt-0.5 font-medium opacity-80">{label}</p>
        {sub && <div className="flex items-center gap-1 mt-1 text-[10px] sm:text-xs opacity-75">{sub}</div>}
      </div>
    </div>
  );
}

function RecentPaymentsSection({ recentPayments }: { recentPayments: RecentPayment[] }) {
  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Derniers paiements</h2>
            <p className="text-xs text-gray-400 hidden sm:block">Toute la plateforme</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full ring-1 ring-emerald-600/10">
          <Activity className="w-3 h-3" /> Temps réel
        </span>
      </div>

      {/* Mobile: cards */}
      <div className="sm:hidden divide-y divide-gray-50">
        {recentPayments.length === 0 ? (
          <div className="text-center py-10">
            <Banknote className="w-10 h-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun paiement récent</p>
          </div>
        ) : (
          recentPayments.map((p) => (
            <div key={p.id} className="p-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-1.5 py-0.5 rounded">{p.orderCode}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ring-1 ${METHOD_COLORS[p.method]}`}>
                      {METHOD_LABELS[p.method] || p.method}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 font-medium truncate">{p.customerName}</p>
                  <p className="text-[11px] text-gray-400 truncate">{p.tenantName}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="text-base font-bold text-gray-900">{formatFCFA(p.amount)}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{formatDateTime(p.createdAt)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop: table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/50">
              <th className="py-3 px-6 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Pressing</th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Commande</th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Client</th>
              <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Méthode</th>
              <th className="py-3 px-4 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Montant</th>
              <th className="py-3 px-6 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recentPayments.map((p) => (
              <tr key={p.id} className="hover:bg-emerald-50/20 transition-colors">
                <td className="py-3 px-6">
                  <span className="font-medium text-gray-700">{p.tenantName}</span>
                </td>
                <td className="py-3 px-4">
                  <span className="font-mono text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">{p.orderCode}</span>
                </td>
                <td className="py-3 px-4 text-gray-600">{p.customerName}</td>
                <td className="py-3 px-4">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ring-1 ${METHOD_COLORS[p.method]}`}>
                    {METHOD_ICONS[p.method]} {METHOD_LABELS[p.method] || p.method}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <span className="font-semibold text-gray-900">{formatFCFA(p.amount)}</span>
                </td>
                <td className="py-3 px-6 text-right text-gray-400 text-xs">{formatDate(p.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs text-gray-500">Page {page} sur {totalPages}</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Précédent
        </button>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Suivant <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="relative w-10 h-10">
        <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
        <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-center py-16">
      <div className="text-gray-200 mx-auto mb-3 w-fit">{icon}</div>
      <p className="text-sm text-gray-400">{text}</p>
    </div>
  );
}
