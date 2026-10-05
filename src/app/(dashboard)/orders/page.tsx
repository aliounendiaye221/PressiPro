"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  Search,
  PlusCircle,
  Package,
  ChevronLeft,
  ChevronRight,
  Filter,
  ClipboardList,
  WifiOff,
  QrCode,
  List,
  LayoutGrid,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatOfflineCacheTime, readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";
import { QrScannerModal } from "@/components/qr-scanner-modal";
import { normalizePhoneForWhatsApp } from "@/lib/phone";
import { useAuth } from "@/components/auth-provider";
import { SwipeableOrderCard } from "@/components/swipeable-order-card";
import { OrdersKanban } from "@/components/orders-kanban";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { actionFeedback, triggerHaptic } from "@/lib/feedback";

interface Order {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  createdAt: string;
  promisedAt: string | null;
  customer: { id: string; name: string; phone: string };
  items: { name: string; quantity: number; total: number }[];
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

const STATUS_LABELS: Record<string, string> = {
  RECU: "Reçu",
  TRAITEMENT: "En traitement",
  PRET: "Prêt",
  LIVRE: "Livré",
};

const STATUS_COLORS: Record<string, string> = {
  RECU: "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-1 ring-blue-600/10",
  TRAITEMENT: "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-600/10",
  PRET: "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-600/10",
  LIVRE: "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-300 ring-1 ring-gray-500/10",
};

function paymentBadge(total: number, paid: number) {
  if (paid >= total) return <span className="badge bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-600/10">PAYÉ</span>;
  if (paid > 0) return <span className="badge bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 ring-1 ring-amber-600/10">PARTIEL</span>;
  return <span className="badge bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 ring-1 ring-red-600/10">IMPAYÉ</span>;
}

function OrdersContent() {
  const searchParams = useSearchParams();
  const { tenant } = useAuth();
  const router = useRouter();

  const initialStatus = searchParams.get("status") || "";
  const initialUnpaid = searchParams.get("unpaid") === "true";
  const initialLate = searchParams.get("late") === "true";
  const initialPeriod = searchParams.get("period") || "";
  const initialQ = searchParams.get("q") || "";

  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState(initialQ);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [unpaidFilter, setUnpaidFilter] = useState(initialUnpaid);
  const [lateFilter, setLateFilter] = useState(initialLate);
  const [periodFilter, setPeriodFilter] = useState(initialPeriod);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isOffline, setIsOffline] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  // Sync state if URL query params change
  useEffect(() => {
    setStatusFilter(searchParams.get("status") || "");
    setUnpaidFilter(searchParams.get("unpaid") === "true");
    setLateFilter(searchParams.get("late") === "true");
    setPeriodFilter(searchParams.get("period") || "");
    if (searchParams.get("q")) {
      setSearch(searchParams.get("q") || "");
    }
    setPage(1);
  }, [searchParams]);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const syncNetworkState = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);

    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (statusFilter) params.set("status", statusFilter);
    if (unpaidFilter) params.set("unpaid", "true");
    if (lateFilter) params.set("late", "true");
    if (periodFilter) params.set("period", periodFilter);
    params.set("page", String(page));
    // When in kanban mode, request more items so columns are full
    if (viewMode === "kanban") {
      params.set("limit", "50");
    }
    const cacheKey = `orders:${params.toString()}`;

    try {
      const res = await fetch(`/api/orders?${params}`);
      if (!res.ok) {
        throw new Error("orders-fetch-failed");
      }

      const data = await res.json();
      setOrders(data.orders || []);
      setTotal(data.total || 0);
      setUsingCache(false);
      setCacheUpdatedAt(new Date().toISOString());
      writeOfflineCache(cacheKey, { orders: data.orders || [], total: data.total || 0 });
    } catch {
      const cached = readOfflineCache<{ orders: Order[]; total: number }>(cacheKey);
      if (cached) {
        setOrders(cached.data.orders || []);
        setTotal(cached.data.total || 0);
        setUsingCache(true);
        setCacheUpdatedAt(cached.updatedAt);
      } else {
        setOrders([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, unpaidFilter, lateFilter, periodFilter, page, viewMode]);

  useEffect(() => {
    const timeout = setTimeout(fetchOrders, 300);
    return () => clearTimeout(timeout);
  }, [fetchOrders]);

  const openWhatsApp = (e: React.MouseEvent, order: Order) => {
    e.preventDefault();
    e.stopPropagation();
    actionFeedback("success");
    const pressingName = tenant?.name || "PressiPro";
    const remaining = order.totalAmount - order.paidAmount;
    let message = `🧺 *${pressingName}*\nBonjour *${order.customer.name || "cher client"}*,\n\nVotre linge déposé sous la commande *${order.code}* est *PRÊT* et disponible au pressing ! ✨`;
    if (remaining > 0) {
      message += `\n\n💰 Reste à régler : *${formatFCFA(remaining)}*`;
    } else {
      message += `\n\n✅ Commande entièrement réglée.`;
    }
    message += `\n\nMerci de votre confiance et à très bientôt ! 🙏`;
    const cleanPhone = normalizePhoneForWhatsApp(order.customer.phone) || order.customer.phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  // Status transition handler for Drag & Drop and Swipe actions
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    // Optimistic update
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );

    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        fetchOrders();
      }
    } catch {
      fetchOrders();
    }
  };

  const advanceSingleStatus = (order: Order) => {
    const nextMap: Record<string, string> = {
      RECU: "TRAITEMENT",
      TRAITEMENT: "PRET",
      PRET: "LIVRE",
    };
    const next = nextMap[order.status];
    if (next) {
      handleStatusChange(order.id, next);
    }
  };

  const getActiveFilterKey = () => {
    if (unpaidFilter) return "unpaid";
    if (lateFilter) return "late";
    if (periodFilter === "today") return "today";
    if (statusFilter) return statusFilter;
    return "all";
  };

  const selectFilterTab = (key: string) => {
    actionFeedback("tap");
    setPage(1);
    if (key === "all") {
      setStatusFilter("");
      setUnpaidFilter(false);
      setLateFilter(false);
      setPeriodFilter("");
      router.replace("/orders");
    } else if (key === "unpaid") {
      setStatusFilter("");
      setUnpaidFilter(true);
      setLateFilter(false);
      setPeriodFilter("");
      router.replace("/orders?unpaid=true");
    } else if (key === "late") {
      setStatusFilter("");
      setUnpaidFilter(false);
      setLateFilter(true);
      setPeriodFilter("");
      router.replace("/orders?late=true");
    } else if (key === "today") {
      setStatusFilter("");
      setUnpaidFilter(false);
      setLateFilter(false);
      setPeriodFilter("today");
      router.replace("/orders?period=today");
    } else {
      setStatusFilter(key);
      setUnpaidFilter(false);
      setLateFilter(false);
      setPeriodFilter("");
      router.replace(`/orders?status=${key}`);
    }
  };

  const activeTab = getActiveFilterKey();

  const filterTabs = [
    { key: "all", label: "Toutes" },
    { key: "unpaid", label: "Impayées", badge: "red" },
    { key: "late", label: "En retard", badge: "amber" },
    { key: "RECU", label: "Reçu" },
    { key: "TRAITEMENT", label: "En traitement" },
    { key: "PRET", label: "Prêt", badge: "emerald" },
    { key: "LIVRE", label: "Livré" },
  ];

  return (
    <PullToRefresh onRefresh={fetchOrders}>
      <div className="space-y-6 animate-fade-in">
        {(isOffline || usingCache) && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>
              Liste issue du cache local
              {formatOfflineCacheTime(cacheUpdatedAt) ? ` du ${formatOfflineCacheTime(cacheUpdatedAt)}` : ""}.
            </span>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Commandes</h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              {total} commande{total > 1 ? "s" : ""} trouvée{total > 1 ? "s" : ""}
              {unpaidFilter && <span className="ml-2 font-semibold text-red-600 dark:text-red-400">· Filtre Impayés</span>}
              {lateFilter && <span className="ml-2 font-semibold text-amber-600 dark:text-amber-400">· Filtre En retard</span>}
              {statusFilter && <span className="ml-2 font-semibold text-primary-600 dark:text-primary-400">· Statut: {STATUS_LABELS[statusFilter]}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle: Liste vs Kanban (Item 7) */}
            <div className="bg-gray-100 dark:bg-slate-800 p-1 rounded-xl flex items-center border border-gray-200/80 dark:border-slate-700">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setViewMode("list");
                }}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === "list"
                    ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                }`}
                title="Affichage en liste"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Liste</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic("light");
                  setViewMode("kanban");
                }}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  viewMode === "kanban"
                    ? "bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-xs"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                }`}
                title="Affichage Kanban interactif"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                actionFeedback("tap");
                setIsScannerOpen(true);
              }}
              className="btn-secondary flex items-center gap-2 text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/60 border-primary-200 dark:border-primary-800 hover:bg-primary-100"
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Scanner Ticket</span>
            </button>
            <Link
              href="/orders/new"
              onClick={() => actionFeedback("tap")}
              className="btn-primary"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Nouveau dépôt</span>
            </Link>
          </div>
        </div>

        {isScannerOpen && (
          <QrScannerModal
            onClose={() => setIsScannerOpen(false)}
            onScan={(url) => {
              setIsScannerOpen(false);
              actionFeedback("tap");
              try {
                const parsed = new URL(url);
                if (parsed.pathname.startsWith('/orders/')) {
                  router.push(parsed.pathname);
                } else {
                  router.push(`/orders?q=${encodeURIComponent(url)}`);
                }
              } catch {
                if (url.startsWith('cm') || url.startsWith('cl') || url.length > 20) {
                  router.push(`/orders/${url}`);
                } else {
                  router.push(`/orders?q=${encodeURIComponent(url)}`);
                }
              }
            }}
          />
        )}

        {/* Filter Tabs (only in List view) */}
        {viewMode === "list" && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-sm no-scrollbar">
            {filterTabs.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => selectFilterTab(tab.key)}
                  className={`px-3.5 py-1.5 rounded-xl font-medium whitespace-nowrap transition-all duration-150 flex items-center gap-1.5 ${
                    isActive
                      ? "bg-primary-600 text-white shadow-sm shadow-primary-600/30 scale-[1.02]"
                      : "bg-white dark:bg-slate-900 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200/70 dark:border-slate-800"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge === "red" && !isActive && (
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  )}
                  {tab.badge === "emerald" && !isActive && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Search & dropdown filter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
            <input
              type="search"
              placeholder="Rechercher (code, nom, tél.)..."
              className="input-field pl-10"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          {viewMode === "list" && (
            <div className="relative">
              <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
              <select
                className="input-field pl-10 pr-8 w-full sm:w-auto appearance-none cursor-pointer"
                value={statusFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setStatusFilter(val);
                  setUnpaidFilter(false);
                  setLateFilter(false);
                  setPage(1);
                }}
              >
                <option value="">Tous les statuts</option>
                <option value="RECU">Reçu</option>
                <option value="TRAITEMENT">En traitement</option>
                <option value="PRET">Prêt</option>
                <option value="LIVRE">Livré</option>
              </select>
            </div>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full border-4 border-primary-100 dark:border-primary-950" />
              <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="card text-center py-16">
            <ClipboardList className="w-12 h-12 text-gray-300 dark:text-slate-700 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-slate-400 font-medium">Aucune commande trouvée</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              {unpaidFilter
                ? "Toutes les commandes sont à jour de paiement !"
                : "Essayez un autre filtre ou créez un nouveau dépôt"}
            </p>
          </div>
        ) : viewMode === "kanban" ? (
          /* Kanban Drag & Drop View (Audit item 7) */
          <OrdersKanban
            orders={orders}
            onStatusChange={handleStatusChange}
            onWhatsApp={openWhatsApp}
            paymentBadge={paymentBadge}
          />
        ) : (
          /* List View with Touch Swipe Actions (Audit item 14) */
          <>
            <div className="grid gap-3">
              {orders.map((order) => (
                <SwipeableOrderCard
                  key={order.id}
                  order={order}
                  statusLabels={STATUS_LABELS}
                  statusColors={STATUS_COLORS}
                  paymentBadge={paymentBadge}
                  onWhatsApp={openWhatsApp}
                  onAdvanceStatus={advanceSingleStatus}
                />
              ))}
            </div>

            {/* Pagination */}
            {total > 20 && (
              <div className="flex items-center justify-center gap-3 mt-6">
                <button
                  className="btn-secondary text-sm"
                  disabled={page <= 1}
                  onClick={() => {
                    triggerHaptic("light");
                    setPage((p) => p - 1);
                  }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Précédent
                </button>
                <span className="text-sm text-gray-500 dark:text-slate-400 px-3">
                  Page {page} / {Math.ceil(total / 20)}
                </span>
                <button
                  className="btn-secondary text-sm"
                  disabled={page >= Math.ceil(total / 20)}
                  onClick={() => {
                    triggerHaptic("light");
                    setPage((p) => p + 1);
                  }}
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PullToRefresh>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-4 border-primary-100 dark:border-primary-950" />
            <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
          </div>
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  );
}
