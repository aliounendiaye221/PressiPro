"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  Banknote,
  Search,
  Download,
  Calendar,
  Wallet,
  Smartphone,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt,
  ArrowRight,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";

interface PaymentItem {
  id: string;
  amount: number;
  method: string;
  createdAt: string;
  orderId: string | null;
  orderCode: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  agentName: string;
}

interface CaisseData {
  payments: PaymentItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  totalAmount: number;
  summaryByMethod: {
    CASH: number;
    WAVE: number;
    OM: number;
    OTHER: number;
  };
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces",
  WAVE: "Wave",
  OM: "Orange Money",
  OTHER: "Autre",
};

const METHOD_BADGES: Record<string, { bg: string; text: string; border: string }> = {
  CASH: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  WAVE: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
  OM: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" },
  OTHER: { bg: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" },
};

function CaisseContent() {
  const { tenant } = useAuth();
  const [data, setData] = useState<CaisseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all" | "today" | "yesterday" | "7d" | "30d">("today");
  const [method, setMethod] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const fetchCaisse = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("period", period);
      if (method !== "ALL") params.set("method", method);
      if (search) params.set("q", search);
      params.set("page", String(page));
      params.set("limit", String(pageSize));

      const res = await fetch(`/api/caisse?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error("Failed to load caisse data", e);
    } finally {
      setLoading(false);
    }
  }, [period, method, search, page, pageSize]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCaisse();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchCaisse]);

  const exportCSV = () => {
    if (!data?.payments || data.payments.length === 0) return;

    const headers = ["Date & Heure", "Commande", "Client", "Telephone", "Mode de Paiement", "Agent Encaisseur", "Montant (FCFA)"];
    const rows = data.payments.map((p) => [
      `"${new Date(p.createdAt).toLocaleString("fr-SN")}"`,
      `"${p.orderCode}"`,
      `"${p.customerName.replace(/"/g, '""')}"`,
      `"${p.customerPhone}"`,
      `"${METHOD_LABELS[p.method] || p.method}"`,
      `"${p.agentName}"`,
      p.amount,
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `journal-de-caisse-${tenant?.name?.replace(/\s+/g, "-") || "pressing"}-${period}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Switcher between Caisse and Dépenses */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary-600 bg-primary-50 border border-primary-100 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Finances Pressing
            </span>
            <span className="text-xs text-gray-400 font-medium">·</span>
            <span className="text-xs text-gray-500 font-bold">{tenant?.name || "PressiPro"}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 mt-1 flex items-center gap-2.5">
            <Banknote className="w-6 h-6 text-emerald-600" />
            <span>Journal de Caisse & Encaissements</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Traçabilité chronologique de tous les règlements, acomptes et soldes enregistrés
          </p>
        </div>

        {/* Links to Dépenses & Bilan */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/expenses"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl shadow-xs transition-colors"
          >
            <Wallet className="w-4 h-4 text-primary-600" />
            <span>Dépenses & Bilan</span>
            <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
          </Link>
          <button
            type="button"
            onClick={exportCSV}
            disabled={!data || data.payments.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl shadow-xs transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exporter CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Financial Synthesis Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Encaissé */}
        <div className="card-levitate bg-gradient-to-br from-emerald-50/60 via-white to-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-emerald-800">
              Total Encaissé
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-600">
            {formatFCFA(data?.totalAmount || 0)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {data?.totalCount || 0} versement{data && data.totalCount > 1 ? "s" : ""} enregistré{data && data.totalCount > 1 ? "s" : ""}
          </p>
        </div>

        {/* Espèces */}
        <div className="card-levitate bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-gray-500">
              Espèces (Cash)
            </span>
            <div className="w-8 h-8 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center">
              <Banknote className="w-4 h-4 text-emerald-600" />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">
            {formatFCFA(data?.summaryByMethod.CASH || 0)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Direct comptoir</p>
        </div>

        {/* Wave */}
        <div className="card-levitate bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-blue-700">
              Paiements Wave
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-blue-600" />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">
            {formatFCFA(data?.summaryByMethod.WAVE || 0)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Mobile Money</p>
        </div>

        {/* Orange Money */}
        <div className="card-levitate bg-white p-4 rounded-2xl border border-gray-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-orange-700">
              Orange Money
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4 text-orange-600" />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-bold text-gray-900">
            {formatFCFA(data?.summaryByMethod.OM || 0)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">Mobile Money</p>
        </div>
      </div>

      {/* Toolbar: Periods, Search & Method Filters */}
      <div className="card p-4 space-y-3 bg-white">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Period selector tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 text-xs no-scrollbar">
            {[
              { id: "today", label: "Aujourd'hui" },
              { id: "yesterday", label: "Hier" },
              { id: "7d", label: "7 derniers jours" },
              { id: "30d", label: "Ce mois" },
              { id: "all", label: "Tout l'historique" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setPeriod(tab.id as any);
                  setPage(1);
                }}
                className={`px-3.5 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all duration-150 cursor-pointer ${
                  period === tab.id
                    ? "bg-primary-600 text-white shadow-xs scale-[1.02]"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200/70"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Method dropdown */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Rechercher cmd, client, agent..."
                className="input-field pl-9 text-xs py-2 w-full"
              />
            </div>

            <select
              value={method}
              onChange={(e) => {
                setMethod(e.target.value);
                setPage(1);
              }}
              className="input-field text-xs py-2 w-auto cursor-pointer"
            >
              <option value="ALL">Tous les modes</option>
              <option value="CASH">Espèces</option>
              <option value="WAVE">Wave</option>
              <option value="OM">Orange Money</option>
              <option value="OTHER">Autre</option>
            </select>

            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="input-field text-xs py-2 w-auto cursor-pointer"
              title="Lignes par page"
            >
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Table on desktop, Cards on mobile */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
            <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
          </div>
        </div>
      ) : !data || data.payments.length === 0 ? (
        <div className="card text-center py-16 bg-white">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-bold text-base">Aucun encaissement trouvé</p>
          <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
            Aucun paiement ne correspond aux filtres sélectionnés. Modifiez la période ou effectuez un nouveau dépôt.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={() => {
                setPeriod("all");
                setMethod("ALL");
                setSearch("");
              }}
              className="btn-secondary text-xs"
            >
              Réinitialiser les filtres
            </button>
            <Link href="/orders/new" className="btn-primary text-xs">
              Nouveau dépôt client
            </Link>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden p-0 bg-white shadow-xs border border-gray-200/80">
          {/* Mobile Card List (sm:hidden) */}
          <div className="sm:hidden divide-y divide-gray-100">
            {data.payments.map((p) => {
              const badge = METHOD_BADGES[p.method] || METHOD_BADGES.OTHER;
              return (
                <div key={p.id} className="p-3.5 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={p.orderId ? `/orders/${p.orderId}` : `/orders?q=${encodeURIComponent(p.orderCode)}`}
                      className="font-mono font-bold text-xs text-primary-700 hover:underline flex items-center gap-1"
                    >
                      <span>{p.orderCode}</span>
                      <ExternalLink className="w-3 h-3 text-gray-400" />
                    </Link>
                    <span className="font-black text-emerald-600 text-sm">
                      +{formatFCFA(p.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    {p.customerId ? (
                      <Link
                        href={`/customers/${p.customerId}`}
                        className="font-bold text-gray-900 hover:text-primary-600 hover:underline flex items-center gap-1"
                        title="Voir tout l'historique de ce client"
                      >
                        <span>{p.customerName}</span>
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                      </Link>
                    ) : (
                      <span className="font-bold text-gray-900">{p.customerName}</span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}>
                      {METHOD_LABELS[p.method] || p.method}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-gray-500 pt-1 border-t border-gray-50">
                    <span>
                      {new Date(p.createdAt).toLocaleString("fr-SN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span>Agent : <strong className="text-gray-700">{p.agentName}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table (hidden sm:block) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50/90 border-b border-gray-100 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Date & Heure</th>
                  <th className="py-3 px-4">N° Commande</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Mode de Règlement</th>
                  <th className="py-3 px-4">Agent Encaisseur</th>
                  <th className="py-3 px-4 text-right">Montant Encaissé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.payments.map((p) => {
                  const badge = METHOD_BADGES[p.method] || METHOD_BADGES.OTHER;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(p.createdAt).toLocaleString("fr-SN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold">
                        <Link
                          href={p.orderId ? `/orders/${p.orderId}` : `/orders?q=${encodeURIComponent(p.orderCode)}`}
                          className="text-primary-600 hover:text-primary-800 hover:underline inline-flex items-center gap-1"
                          title="Voir la commande"
                        >
                          <span>{p.orderCode}</span>
                          <ExternalLink className="w-3 h-3 text-gray-300" />
                        </Link>
                      </td>

                      <td className="py-3 px-4 font-medium text-gray-900">
                        {p.customerId ? (
                          <Link
                            href={`/customers/${p.customerId}`}
                            className="hover:text-primary-600 hover:underline inline-flex items-center gap-1 font-bold group"
                            title="Voir l'historique et la fiche de ce client"
                          >
                            <span>{p.customerName}</span>
                            <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-primary-500 transition-colors" />
                          </Link>
                        ) : (
                          <span>{p.customerName}</span>
                        )}
                        {p.customerPhone && (
                          <span className="text-xs text-gray-400 block font-normal">{p.customerPhone}</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${badge.bg} ${badge.text} ${badge.border}`}>
                          {METHOD_LABELS[p.method] || p.method}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-xs text-gray-600 font-medium whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-semibold text-[11px]">
                          {p.agentName}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-black text-emerald-600 whitespace-nowrap text-base">
                        +{formatFCFA(p.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-gray-100 bg-gray-50/50">
              <span className="text-xs text-gray-500">
                Affichage page <strong>{data.page}</strong> sur <strong>{data.totalPages}</strong> ({data.totalCount} transactions)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Précédent</span>
                </button>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-50"
                >
                  <span>Suivant</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CaissePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      }
    >
      <CaisseContent />
    </Suspense>
  );
}
