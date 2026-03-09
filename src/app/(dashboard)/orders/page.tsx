"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
import { formatOfflineCacheTime, readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";

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
  return new Intl.NumberFormat("fr-SN").format(n) + " F";
}

const STATUS_LABELS: Record<string, string> = {
  RECU: "Reçu",
  TRAITEMENT: "En traitement",
  PRET: "Prêt",
  LIVRE: "Livré",
};

const STATUS_COLORS: Record<string, string> = {
  RECU: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/10",
  TRAITEMENT: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10",
  PRET: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10",
  LIVRE: "bg-gray-100 text-gray-600 ring-1 ring-gray-500/10",
};

function paymentBadge(total: number, paid: number) {
  if (paid >= total) return <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10">PAYÉ</span>;
  if (paid > 0) return <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-600/10">PARTIEL</span>;
  return <span className="badge bg-red-50 text-red-700 ring-1 ring-red-600/10">IMPAYÉ</span>;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isOffline, setIsOffline] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);

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
    params.set("page", String(page));
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
  }, [search, statusFilter, page]);

  useEffect(() => {
    const timeout = setTimeout(fetchOrders, 300);
    return () => clearTimeout(timeout);
  }, [fetchOrders]);

  return (
    <div className="space-y-6">
      {(isOffline || usingCache) && (
        <div className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            Liste issue du cache local
            {formatOfflineCacheTime(cacheUpdatedAt) ? ` du ${formatOfflineCacheTime(cacheUpdatedAt)}` : ""}.
          </span>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Commandes</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} commande{total > 1 ? "s" : ""} au total</p>
        </div>
        <Link href="/orders/new" className="btn-primary">
          <PlusCircle className="w-4 h-4" />
          Nouveau dépôt
        </Link>
      </div>

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            placeholder="Rechercher (code, nom, tél.)..."
            className="input-field pl-10"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <select
            className="input-field pl-10 pr-8 w-auto appearance-none cursor-pointer"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">Tous les statuts</option>
            <option value="RECU">Reçu</option>
            <option value="TRAITEMENT">En traitement</option>
            <option value="PRET">Prêt</option>
            <option value="LIVRE">Livré</option>
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
            <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-16">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Aucune commande trouvée</p>
          <p className="text-sm text-gray-400 mt-1">Essayez un autre filtre ou créez un nouveau dépôt</p>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="group card hover:shadow-lg hover:border-primary-100 transition-all duration-200 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex items-center gap-3 sm:w-10">
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center group-hover:bg-primary-100 transition-colors shrink-0">
                    <Package className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-base text-gray-900">{order.code}</span>
                    <span className={`badge ${STATUS_COLORS[order.status]}`}>
                      {STATUS_LABELS[order.status]}
                    </span>
                    {paymentBadge(order.totalAmount, order.paidAmount)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    {order.customer.name} · <span className="text-gray-400">{order.customer.phone}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base sm:text-lg font-bold text-gray-900">{formatFCFA(order.totalAmount)}</p>
                  {order.paidAmount < order.totalAmount && (
                    <p className="text-xs text-red-500 font-medium">
                      Reste: {formatFCFA(order.totalAmount - order.paidAmount)}
                    </p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(order.createdAt).toLocaleDateString("fr-SN")}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {total > 20 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                className="btn-secondary text-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="w-4 h-4" />
                Précédent
              </button>
              <span className="text-sm text-gray-500 px-3">
                Page {page} / {Math.ceil(total / 20)}
              </span>
              <button
                className="btn-secondary text-sm"
                disabled={page * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
