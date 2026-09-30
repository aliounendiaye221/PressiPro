"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PlusCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Trash2,
  FileSpreadsheet,
  PieChart,
  BarChart3,
  Receipt,
  Wallet,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Banknote,
} from "lucide-react";
import { AddExpenseModal } from "@/components/add-expense-modal";
import { useAuth } from "@/components/auth-provider";

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  paymentMethod: string;
  supplier: string | null;
  notes: string | null;
  createdAt: string;
}

interface FinancialSummary {
  month: string;
  monthLabel: string;
  revenue: number;
  paymentCount: number;
  expenses: number;
  expenseCount: number;
  netProfit: number;
  isProfit: boolean;
  margin: number;
  categoryBreakdown: {
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }[];
  monthlyComparison: {
    monthKey: string;
    label: string;
    revenue: number;
    expenses: number;
    netProfit: number;
    isProfit: boolean;
  }[];
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

const CATEGORY_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  PRODUITS: { label: "Produits & Lessive", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  LIVRAISON: { label: "Livraison & Transport", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  MATERIEL: { label: "Matériel & Entretien", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  CHARGES_FIXES: { label: "Charges Fixes (Senelec/Loyer)", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  SALAIRES: { label: "Salaires & Personnel", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  AUTRE: { label: "Autres dépenses", color: "text-gray-700", bg: "bg-gray-50 border-gray-200" },
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Espèces",
  WAVE: "Wave",
  OM: "Orange Money",
  OTHER: "Autre",
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  // Current selected month
  const now = new Date();
  const initialMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [selectedMonth, setSelectedMonth] = useState(initialMonthKey);

  // View tabs
  const [activeTab, setActiveTab] = useState<"bilan" | "liste">("bilan");

  // Summary & expenses state
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Navigation across months
  const navigateMonth = (direction: -1 | 1) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + direction, 1);
    const newKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setSelectedMonth(newKey);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Load summary
      const sumRes = await fetch(`/api/expenses/summary?month=${selectedMonth}`);
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }

      // 2. Load list of expenses
      const expParams = new URLSearchParams();
      expParams.set("month", selectedMonth);
      if (categoryFilter) expParams.set("category", categoryFilter);
      if (search) expParams.set("q", search);
      expParams.set("limit", "100");

      const expRes = await fetch(`/api/expenses?${expParams}`);
      if (expRes.ok) {
        const expData = await expRes.json();
        setExpenses(expData.expenses || []);
      }
    } catch (e) {
      console.error("Error loading expenses data", e);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, categoryFilter, search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette dépense ?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        await loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingId(null);
    }
  };

  const exportCSV = () => {
    if (expenses.length === 0) return;
    const headers = ["Date", "Description", "Catégorie", "Moyen de Règlement", "Fournisseur", "Montant (FCFA)"];
    const rows = expenses.map((e) => [
      `"${new Date(e.date).toLocaleDateString("fr-SN")}"`,
      `"${e.description.replace(/"/g, '""')}"`,
      `"${CATEGORY_LABELS[e.category]?.label || e.category}"`,
      `"${PAYMENT_LABELS[e.paymentMethod] || e.paymentMethod}"`,
      `"${(e.supplier || "").replace(/"/g, '""')}"`,
      e.amount,
    ]);
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `depenses_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compute maximum value for comparison charts
  const maxBarValue = summary?.monthlyComparison
    ? Math.max(1, ...summary.monthlyComparison.map((m) => Math.max(m.revenue, m.expenses)))
    : 1;

  return (
    <div className="space-y-6">
      {/* Header & Month Navigator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span>Dépenses & Rentabilité</span>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full font-semibold border border-emerald-200/50">
              Bilan Financier
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Suivi des achats, charges d&apos;exploitation et calcul des bénéfices nets
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Month selector */}
          <div className="flex items-center bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => navigateMonth(-1)}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              title="Mois précédent"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="px-3 text-sm font-bold text-gray-900 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary-600" />
              <span>{summary?.monthLabel || selectedMonth}</span>
            </div>
            <button
              onClick={() => navigateMonth(1)}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors"
              title="Mois suivant"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="btn-primary text-sm flex items-center gap-2 bg-red-600 hover:bg-red-700 border-red-600 text-white shadow-sm shadow-red-600/20 active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Ajouter une dépense</span>
            </button>
          )}
        </div>
      </div>

      {/* 3 Master Financial KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Revenue Card */}
        <div className="card-levitate glow-card glow-card-emerald bg-gradient-to-br from-emerald-50/50 via-white to-white relative overflow-hidden">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Chiffre d&apos;Affaires</span>
              <p className="text-xs text-emerald-700 font-semibold">Total Encaissé (Paiements)</p>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-gray-900">
            {formatFCFA(summary?.revenue || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {summary?.paymentCount || 0} versement{summary && summary.paymentCount > 1 ? "s" : ""} enregistré{summary && summary.paymentCount > 1 ? "s" : ""} ce mois
          </p>
        </div>

        {/* Expenses Card */}
        <div className="card-levitate glow-card glow-card-red bg-gradient-to-br from-red-50/50 via-white to-white relative overflow-hidden">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
              <TrendingDown className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Dépenses</span>
              <p className="text-xs text-red-700 font-semibold">Achats & Charges du mois</p>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-red-600">
            {formatFCFA(summary?.expenses || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            {summary?.expenseCount || 0} dépense{summary && summary.expenseCount > 1 ? "s" : ""} saisie{summary && summary.expenseCount > 1 ? "s" : ""} ce mois
          </p>
        </div>

        {/* Net Profit / Loss Master Card */}
        <div
          className={`card-levitate glow-card relative overflow-hidden border-2 ${
            summary && summary.netProfit >= 0
              ? "bg-gradient-to-br from-emerald-50/70 via-white to-white border-emerald-300"
              : "bg-gradient-to-br from-red-50/70 via-white to-white border-red-300"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-10 h-10 text-white rounded-xl flex items-center justify-center shadow-lg ${
                  summary && summary.netProfit >= 0
                    ? "bg-emerald-600 shadow-emerald-600/30"
                    : "bg-red-600 shadow-red-600/30"
                }`}
              >
                {summary && summary.netProfit >= 0 ? (
                  <Sparkles className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Résultat Net</span>
                <p
                  className={`text-xs font-bold ${
                    summary && summary.netProfit >= 0 ? "text-emerald-700" : "text-red-700"
                  }`}
                >
                  {summary && summary.netProfit >= 0 ? "BÉNÉFICE DU MOIS 🟢" : "PERTE DU MOIS 🔴"}
                </p>
              </div>
            </div>

            {summary && summary.revenue > 0 && (
              <span
                className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                  summary.netProfit >= 0
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {summary.margin}% de marge
              </span>
            )}
          </div>

          <p
            className={`text-2xl sm:text-3xl font-black ${
              summary && summary.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {summary && summary.netProfit >= 0 ? "+ " : ""}
            {formatFCFA(summary?.netProfit || 0)}
          </p>

          <p className="text-xs text-gray-500 mt-2">
            {summary && summary.netProfit >= 0
              ? "Vos recettes couvrent l'intégralité des dépenses et génèrent du profit !"
              : "Les dépenses dépassent les encaissements du mois. Surveillez les charges fixes."}
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 gap-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("bilan")}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "bilan"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Comparateur des mois & Bilan</span>
          </button>
          <button
            onClick={() => setActiveTab("liste")}
            className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "liste"
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-gray-500 hover:text-gray-900"
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Détail des Achats ({expenses.length})</span>
          </button>
        </div>

        <Link
          href="/caisse"
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 mb-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition-colors shadow-2xs"
        >
          <Banknote className="w-4 h-4 text-emerald-600" />
          <span>Journal de Caisse & Encaissements →</span>
        </Link>
      </div>

      {/* TAB 1: Bilan & Comparateur */}
      {activeTab === "bilan" && (
        <div className="space-y-6">
          {/* Monthly Comparison Bar Chart */}
          <div className="card card-levitate bg-white">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  Comparateur des Mois (Gains vs Pertes)
                </h3>
                <p className="text-xs text-gray-500">
                  Évolution des recettes (bleu), dépenses (rouge) et bénéfice net sur les 6 derniers mois
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500 inline-block" />
                  <span className="text-gray-600">Recettes (CA)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-400 inline-block" />
                  <span className="text-gray-600">Dépenses</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                  <span className="text-gray-600">Bénéfice</span>
                </div>
              </div>
            </div>

            {/* Visual Bar Comparison */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {summary?.monthlyComparison.map((m) => {
                const revHeight = Math.max(12, Math.round((m.revenue / maxBarValue) * 120));
                const expHeight = Math.max(12, Math.round((m.expenses / maxBarValue) * 120));
                const isCurrent = m.monthKey === selectedMonth;

                return (
                  <div
                    key={m.monthKey}
                    onClick={() => setSelectedMonth(m.monthKey)}
                    className={`rounded-2xl p-3 border transition-all cursor-pointer hover:shadow-md flex flex-col justify-between ${
                      isCurrent
                        ? "bg-primary-50/50 border-primary-300 ring-2 ring-primary-500/20 shadow-sm"
                        : "bg-gray-50/60 border-gray-100 hover:bg-white"
                    }`}
                  >
                    <div>
                      <p className="text-xs font-bold text-gray-900 truncate">{m.label.split(" ")[0]}</p>
                      <p className="text-[10px] text-gray-400">{m.label.split(" ")[1]}</p>
                    </div>

                    {/* Bars visual */}
                    <div className="h-32 flex items-end justify-center gap-2 my-3 pt-2">
                      <div className="flex flex-col items-center gap-1">
                        <div
                          style={{ height: `${revHeight}px` }}
                          className="w-4 rounded-t bg-blue-500 shadow-sm transition-all"
                          title={`Recettes : ${formatFCFA(m.revenue)}`}
                        />
                        <span className="text-[9px] text-gray-400 font-bold">CA</span>
                      </div>
                      <div className="flex flex-col items-center gap-1">
                        <div
                          style={{ height: `${expHeight}px` }}
                          className="w-4 rounded-t bg-red-400 shadow-sm transition-all"
                          title={`Dépenses : ${formatFCFA(m.expenses)}`}
                        />
                        <span className="text-[9px] text-gray-400 font-bold">Dép</span>
                      </div>
                    </div>

                    {/* Result badge */}
                    <div
                      className={`text-center py-1 rounded-lg text-xs font-bold ${
                        m.isProfit
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {m.isProfit ? "+" : ""}
                      {formatFCFA(m.netProfit)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Comparison Table */}
            <div className="mt-8 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="py-2.5 font-bold">Mois</th>
                    <th className="py-2.5 text-right font-bold">Recettes (CA)</th>
                    <th className="py-2.5 text-right font-bold">Dépenses Totales</th>
                    <th className="py-2.5 text-right font-bold">Résultat Net</th>
                    <th className="py-2.5 text-center font-bold">Statut Rentabilité</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary?.monthlyComparison.map((m) => (
                    <tr
                      key={m.monthKey}
                      className={`hover:bg-gray-50/50 transition-colors ${
                        m.monthKey === selectedMonth ? "bg-primary-50/30 font-semibold" : ""
                      }`}
                    >
                      <td className="py-3 text-gray-900 font-medium">{m.label}</td>
                      <td className="py-3 text-right font-semibold text-gray-900">{formatFCFA(m.revenue)}</td>
                      <td className="py-3 text-right font-semibold text-red-600">{formatFCFA(m.expenses)}</td>
                      <td
                        className={`py-3 text-right font-black ${
                          m.isProfit ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {m.isProfit ? "+ " : ""}
                        {formatFCFA(m.netProfit)}
                      </td>
                      <td className="py-3 text-center">
                        <span
                          className={`badge text-xs font-bold ${
                            m.isProfit
                              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10"
                              : "bg-red-50 text-red-700 ring-1 ring-red-600/10"
                          }`}
                        >
                          {m.isProfit ? "🟢 Bénéficiaire" : "🔴 Déficitaire"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="card card-levitate bg-white">
            <h3 className="text-base font-bold text-gray-900 mb-1">
              Répartition des Dépenses de {summary?.monthLabel}
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              Où part l&apos;argent de votre pressing ce mois-ci ?
            </p>

            {(!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0) ? (
              <p className="text-center py-8 text-sm text-gray-400">
                Aucune dépense enregistrée sur ce mois.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {summary.categoryBreakdown.map((cat) => {
                  const info = CATEGORY_LABELS[cat.category] || CATEGORY_LABELS.AUTRE;
                  return (
                    <div
                      key={cat.category}
                      className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${info.bg} ${info.color}`}>
                          {info.label}
                        </span>
                        <span className="text-xs font-bold text-gray-900">{cat.percentage}%</span>
                      </div>

                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${cat.percentage}%` }}
                          className="h-full bg-primary-600 rounded-full"
                        />
                      </div>

                      <div className="flex justify-between items-center text-xs text-gray-500 pt-1">
                        <span>{cat.count} opération{cat.count > 1 ? "s" : ""}</span>
                        <span className="font-bold text-gray-900">{formatFCFA(cat.amount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Liste des Dépenses */}
      {activeTab === "liste" && (
        <div className="space-y-4">
          {/* Controls: Search, Category filter, CSV Export */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="search"
                  placeholder="Rechercher dépense, fournisseur..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-field pl-10 text-sm"
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input-field text-sm cursor-pointer w-auto"
              >
                <option value="">Toutes les catégories</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={exportCSV}
              disabled={expenses.length === 0}
              className="btn-secondary text-sm flex items-center gap-2 self-end sm:self-auto"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Exporter CSV</span>
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="relative w-10 h-10">
                <div className="absolute inset-0 rounded-full border-4 border-primary-100" />
                <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
              </div>
            </div>
          ) : expenses.length === 0 ? (
            <div className="card text-center py-16">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">Aucune dépense enregistrée</p>
              <p className="text-sm text-gray-400 mt-1">
                Cliquez sur « Ajouter une dépense » pour enregistrer vos achats.
              </p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0 bg-white">
              {/* Mobile Card List (sm:hidden) */}
              <div className="sm:hidden divide-y divide-gray-100">
                {expenses.map((e) => {
                  const catInfo = CATEGORY_LABELS[e.category] || CATEGORY_LABELS.AUTRE;
                  return (
                    <div key={e.id} className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${catInfo.bg} ${catInfo.color}`}>
                          {catInfo.label}
                        </span>
                        <span className="font-bold text-red-600 text-sm">
                          - {formatFCFA(e.amount)}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm leading-snug">{e.description}</p>
                        {e.notes && <p className="text-xs text-gray-400 mt-0.5">{e.notes}</p>}
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
                        <span className="font-mono text-[11px]">
                          {new Date(e.date).toLocaleDateString("fr-SN")} · {PAYMENT_LABELS[e.paymentMethod] || e.paymentMethod}
                          {e.supplier ? ` · ${e.supplier}` : ""}
                        </span>
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteExpense(e.id)}
                            disabled={deletingId === e.id}
                            title="Supprimer la dépense"
                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (hidden sm:block) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-4 font-bold">Description</th>
                      <th className="py-3 px-4 font-bold">Catégorie</th>
                      <th className="py-3 px-4 font-bold">Règlement</th>
                      <th className="py-3 px-4 font-bold">Fournisseur</th>
                      <th className="py-3 px-4 text-right font-bold">Montant</th>
                      {isAdmin && <th className="py-3 px-4 text-center font-bold">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.map((e) => {
                      const catInfo = CATEGORY_LABELS[e.category] || CATEGORY_LABELS.AUTRE;
                      return (
                        <tr key={e.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-3 px-4 text-gray-500 whitespace-nowrap text-xs">
                            {new Date(e.date).toLocaleDateString("fr-SN")}
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-900">
                            {e.description}
                            {e.notes && <p className="text-xs text-gray-400 font-normal">{e.notes}</p>}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${catInfo.bg} ${catInfo.color}`}>
                              {catInfo.label}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-gray-600 text-xs whitespace-nowrap">
                            {PAYMENT_LABELS[e.paymentMethod] || e.paymentMethod}
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-xs whitespace-nowrap">
                            {e.supplier || "—"}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-red-600 whitespace-nowrap">
                            - {formatFCFA(e.amount)}
                          </td>
                          {isAdmin && (
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                onClick={() => handleDeleteExpense(e.id)}
                                disabled={deletingId === e.id}
                                title="Supprimer la dépense"
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Expense Modal */}
      {isAddModalOpen && (
        <AddExpenseModal
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={loadData}
        />
      )}
    </div>
  );
}
