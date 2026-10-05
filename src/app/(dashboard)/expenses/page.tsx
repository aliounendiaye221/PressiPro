"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  TrendingUp,
  TrendingDown,
  PlusCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  FileSpreadsheet,
  BarChart3,
  Receipt,
  AlertTriangle,
  Sparkles,
  Banknote,
  ShieldAlert,
} from "lucide-react";
import { AddExpenseModal } from "@/components/add-expense-modal";
import { useAuth } from "@/components/auth-provider";
import { MultiMonthChart } from "@/components/multi-month-chart";
import { AnimatedNumber } from "@/components/animated-number";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { triggerHaptic, playFeedbackSound } from "@/lib/feedback";

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
  PRODUITS: {
    label: "Produits & Lessive",
    color: "text-blue-700 dark:text-blue-300",
    bg: "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/40",
  },
  LIVRAISON: {
    label: "Livraison & Transport",
    color: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/40",
  },
  MATERIEL: {
    label: "Matériel & Entretien",
    color: "text-purple-700 dark:text-purple-300",
    bg: "bg-purple-50 dark:bg-purple-950/50 border-purple-200 dark:border-purple-800/40",
  },
  CHARGES_FIXES: {
    label: "Charges Fixes (Senelec/Loyer)",
    color: "text-orange-700 dark:text-orange-300",
    bg: "bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800/40",
  },
  SALAIRES: {
    label: "Salaires & Personnel",
    color: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/40",
  },
  AUTRE: {
    label: "Autres dépenses",
    color: "text-gray-700 dark:text-gray-300",
    bg: "bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700",
  },
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
    triggerHaptic("light");
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

  const handleRefresh = async () => {
    triggerHaptic("medium");
    await loadData();
    playFeedbackSound("success");
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette dépense ?")) return;
    setDeletingId(id);
    triggerHaptic("warning");
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        triggerHaptic("success");
        playFeedbackSound("success");
        await loadData();
      }
    } catch (e) {
      console.error(e);
      triggerHaptic("error");
    } finally {
      setDeletingId(null);
    }
  };

  const exportCSV = () => {
    if (expenses.length === 0) return;
    triggerHaptic("selection");
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

  if (user && !isAdmin) {
    return (
      <div className="card text-center py-16 max-w-lg mx-auto space-y-4 bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Accès confidentiel restreint
          </h2>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Les dépenses et le bilan financier sont strictement réservés à l&apos;administrateur et au propriétaire du pressing.
          </p>
        </div>
        <Link href="/dashboard" className="btn-primary inline-flex items-center gap-2 text-sm mx-auto">
          Retour au tableau de bord
        </Link>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6">
        {/* Header & Month Navigator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Dépenses & Rentabilité</span>
              <span className="text-xs bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-full font-semibold border border-emerald-200/50 dark:border-emerald-800/40">
                Bilan Financier
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              Suivi des achats, charges d&apos;exploitation et calcul des bénéfices nets
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Month selector */}
            <div className="flex items-center bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-1 shadow-sm">
              <button
                onClick={() => navigateMonth(-1)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500 dark:text-slate-400 transition-colors"
                title="Mois précédent"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                <span>{summary?.monthLabel || selectedMonth}</span>
              </div>
              <button
                onClick={() => navigateMonth(1)}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg text-gray-500 dark:text-slate-400 transition-colors"
                title="Mois suivant"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  triggerHaptic("medium");
                  setIsAddModalOpen(true);
                }}
                className="btn-primary text-sm flex items-center gap-2 bg-red-600 hover:bg-red-700 border-red-600 text-white shadow-sm shadow-red-600/20 active:scale-95"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Ajouter une dépense</span>
              </button>
            )}
          </div>
        </div>

        {/* 3 Master Financial KPI Cards with Animated Numbers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Revenue Card */}
          <div className="card-levitate glow-card glow-card-emerald bg-gradient-to-br from-emerald-50/50 via-white to-white dark:from-emerald-950/30 dark:via-slate-900 dark:to-slate-900 border border-gray-100 dark:border-slate-800 relative overflow-hidden">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 bg-emerald-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                  Chiffre d&apos;Affaires
                </span>
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                  Total Encaissé (Paiements)
                </p>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white">
              <AnimatedNumber value={summary?.revenue || 0} formatAsFCFA />
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              {summary?.paymentCount || 0} versement{summary && summary.paymentCount > 1 ? "s" : ""} enregistré{summary && summary.paymentCount > 1 ? "s" : ""} ce mois
            </p>
          </div>

          {/* Expenses Card */}
          <div className="card-levitate glow-card glow-card-red bg-gradient-to-br from-red-50/50 via-white to-white dark:from-red-950/30 dark:via-slate-900 dark:to-slate-900 border border-gray-100 dark:border-slate-800 relative overflow-hidden">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 bg-red-500 text-white rounded-xl flex items-center justify-center shadow-lg shadow-red-500/20">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                  Total Dépenses
                </span>
                <p className="text-xs text-red-700 dark:text-red-400 font-semibold">
                  Achats & Charges du mois
                </p>
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-red-600 dark:text-red-400">
              <AnimatedNumber value={summary?.expenses || 0} formatAsFCFA />
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              {summary?.expenseCount || 0} dépense{summary && summary.expenseCount > 1 ? "s" : ""} saisie{summary && summary.expenseCount > 1 ? "s" : ""} ce mois
            </p>
          </div>

          {/* Net Profit / Loss Master Card */}
          <div
            className={`card-levitate glow-card relative overflow-hidden border-2 ${
              summary && summary.netProfit >= 0
                ? "bg-gradient-to-br from-emerald-50/70 via-white to-white dark:from-emerald-950/40 dark:via-slate-900 dark:to-slate-900 border-emerald-300 dark:border-emerald-800/60"
                : "bg-gradient-to-br from-red-50/70 via-white to-white dark:from-red-950/40 dark:via-slate-900 dark:to-slate-900 border-red-300 dark:border-red-800/60"
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-slate-400">
                    Résultat Net
                  </span>
                  <p
                    className={`text-xs font-bold ${
                      summary && summary.netProfit >= 0
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-700 dark:text-red-400"
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
                      ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50"
                      : "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800/50"
                  }`}
                >
                  {summary.margin}% marge
                </span>
              )}
            </div>

            <p
              className={`text-2xl sm:text-3xl font-black ${
                summary && summary.netProfit >= 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {summary && summary.netProfit >= 0 ? "+ " : ""}
              <AnimatedNumber value={summary?.netProfit || 0} formatAsFCFA />
            </p>

            <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
              {summary && summary.netProfit >= 0
                ? "Vos recettes couvrent l'intégralité des dépenses et génèrent du profit !"
                : "Les dépenses dépassent les encaissements du mois. Surveillez les charges fixes."}
            </p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-200 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              onClick={() => {
                triggerHaptic("selection");
                setActiveTab("bilan");
              }}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "bilan"
                  ? "border-primary-600 dark:border-primary-500 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Comparateur des mois & Bilan</span>
            </button>
            <button
              onClick={() => {
                triggerHaptic("selection");
                setActiveTab("liste");
              }}
              className={`pb-3 px-4 text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === "liste"
                  ? "border-primary-600 dark:border-primary-500 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Détail des Achats ({expenses.length})</span>
            </button>
          </div>

          <Link
            href="/caisse"
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 mb-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/80 dark:border-emerald-800/50 rounded-xl transition-colors shadow-2xs"
          >
            <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Journal de Caisse & Encaissements →</span>
          </Link>
        </div>

        {/* TAB 1: Bilan & Comparateur */}
        {activeTab === "bilan" && (
          <div className="space-y-6">
            {/* Monthly Comparison Bar & Line Chart (Item 22) */}
            <div className="card card-levitate bg-white dark:bg-slate-900/90 border border-gray-100 dark:border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span>Comparateur des Mois (Gains vs Pertes)</span>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-950 text-primary-700 dark:text-primary-300">
                      6 Derniers Mois
                    </span>
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    Barres groupées Recettes vs Dépenses, courbe de rentabilité et sélection instantanée
                  </p>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-blue-500 inline-block shadow-xs" />
                    <span className="text-gray-600 dark:text-slate-300">Recettes (CA)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-red-400 inline-block shadow-xs" />
                    <span className="text-gray-600 dark:text-slate-300">Dépenses</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500 inline-block shadow-xs" />
                    <span className="text-gray-600 dark:text-slate-300">Profit Net</span>
                  </div>
                </div>
              </div>

              {/* Enhanced Visual MultiMonthChart (Item 22) */}
              <MultiMonthChart
                data={summary?.monthlyComparison || []}
                selectedMonth={selectedMonth}
                onSelectMonth={(key) => setSelectedMonth(key)}
              />

              {/* Comparison Table */}
              <div className="mt-8 overflow-x-auto border-t border-gray-100 dark:border-slate-800 pt-6">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-slate-800 text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider">
                      <th className="py-2.5 font-bold">Mois</th>
                      <th className="py-2.5 text-right font-bold">Recettes (CA)</th>
                      <th className="py-2.5 text-right font-bold">Dépenses Totales</th>
                      <th className="py-2.5 text-right font-bold">Résultat Net</th>
                      <th className="py-2.5 text-center font-bold">Statut Rentabilité</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                    {summary?.monthlyComparison.map((m) => (
                      <tr
                        key={m.monthKey}
                        onClick={() => setSelectedMonth(m.monthKey)}
                        className={`hover:bg-gray-50/50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${
                          m.monthKey === selectedMonth
                            ? "bg-primary-50/40 dark:bg-primary-950/30 font-semibold"
                            : ""
                        }`}
                      >
                        <td className="py-3 text-gray-900 dark:text-white font-medium">
                          {m.label}
                          {m.monthKey === selectedMonth && (
                            <span className="ml-2 text-[10px] font-bold text-primary-600 dark:text-primary-400 uppercase">
                              (Actif)
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right font-semibold text-gray-900 dark:text-white">
                          {formatFCFA(m.revenue)}
                        </td>
                        <td className="py-3 text-right font-semibold text-red-600 dark:text-red-400">
                          {formatFCFA(m.expenses)}
                        </td>
                        <td
                          className={`py-3 text-right font-black ${
                            m.isProfit
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {m.isProfit ? "+ " : ""}
                          {formatFCFA(m.netProfit)}
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`badge text-xs font-bold ${
                              m.isProfit
                                ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-600/20"
                                : "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 ring-1 ring-red-600/20"
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
            <div className="card card-levitate bg-white dark:bg-slate-900/90 border border-gray-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white mb-1">
                Répartition des Dépenses de {summary?.monthLabel}
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-400 mb-6">
                Où part l&apos;argent de votre pressing ce mois-ci ?
              </p>

              {!summary?.categoryBreakdown || summary.categoryBreakdown.length === 0 ? (
                <p className="text-center py-8 text-sm text-gray-400 dark:text-slate-500">
                  Aucune dépense enregistrée sur ce mois.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {summary.categoryBreakdown.map((cat) => {
                    const info = CATEGORY_LABELS[cat.category] || CATEGORY_LABELS.AUTRE;
                    return (
                      <div
                        key={cat.category}
                        className="p-4 rounded-xl border border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/40 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${info.bg} ${info.color}`}>
                            {info.label}
                          </span>
                          <span className="text-xs font-bold text-gray-900 dark:text-white">
                            {cat.percentage}%
                          </span>
                        </div>

                        <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${cat.percentage}%` }}
                            className="h-full bg-primary-600 rounded-full transition-all duration-500"
                          />
                        </div>

                        <div className="flex justify-between items-center text-xs text-gray-500 dark:text-slate-400 pt-1">
                          <span>
                            {cat.count} opération{cat.count > 1 ? "s" : ""}
                          </span>
                          <span className="font-bold text-gray-900 dark:text-white">
                            {formatFCFA(cat.amount)}
                          </span>
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
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
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
                  <div className="absolute inset-0 rounded-full border-4 border-primary-100 dark:border-primary-950" />
                  <div className="absolute inset-0 rounded-full border-4 border-primary-600 border-t-transparent animate-spin" />
                </div>
              </div>
            ) : expenses.length === 0 ? (
              <div className="card text-center py-16 dark:bg-slate-900/50">
                <Receipt className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-slate-400 font-medium">Aucune dépense enregistrée</p>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                  Cliquez sur « Ajouter une dépense » pour enregistrer vos achats.
                </p>
              </div>
            ) : (
              <div className="card overflow-hidden p-0 bg-white dark:bg-slate-900/90 border border-gray-100 dark:border-slate-800">
                {/* Mobile Card List (sm:hidden) */}
                <div className="sm:hidden divide-y divide-gray-100 dark:divide-slate-800">
                  {expenses.map((e) => {
                    const catInfo = CATEGORY_LABELS[e.category] || CATEGORY_LABELS.AUTRE;
                    return (
                      <div key={e.id} className="p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-lg border ${catInfo.bg} ${catInfo.color}`}
                          >
                            {catInfo.label}
                          </span>
                          <span className="font-bold text-red-600 dark:text-red-400 text-sm">
                            - {formatFCFA(e.amount)}
                          </span>
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm leading-snug">
                            {e.description}
                          </p>
                          {e.notes && (
                            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                              {e.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-slate-400 pt-1">
                          <span className="text-[11px]">
                            {new Date(e.date).toLocaleDateString("fr-SN")} ·{" "}
                            {PAYMENT_LABELS[e.paymentMethod] || e.paymentMethod}
                            {e.supplier ? ` · ${e.supplier}` : ""}
                          </span>
                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteExpense(e.id)}
                              disabled={deletingId === e.id}
                              title="Supprimer la dépense"
                              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors ml-2"
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
                    <thead className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-800 text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider">
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
                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800/80">
                      {expenses.map((e) => {
                        const catInfo = CATEGORY_LABELS[e.category] || CATEGORY_LABELS.AUTRE;
                        return (
                          <tr
                            key={e.id}
                            className="hover:bg-gray-50/50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3 px-4 text-gray-500 dark:text-slate-400 whitespace-nowrap text-xs">
                              {new Date(e.date).toLocaleDateString("fr-SN")}
                            </td>
                            <td className="py-3 px-4 font-semibold text-gray-900 dark:text-white">
                              {e.description}
                              {e.notes && (
                                <p className="text-xs text-gray-400 dark:text-slate-500 font-normal">
                                  {e.notes}
                                </p>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-lg border ${catInfo.bg} ${catInfo.color}`}
                              >
                                {catInfo.label}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-gray-600 dark:text-slate-300 text-xs whitespace-nowrap">
                              {PAYMENT_LABELS[e.paymentMethod] || e.paymentMethod}
                            </td>
                            <td className="py-3 px-4 text-gray-500 dark:text-slate-400 text-xs whitespace-nowrap">
                              {e.supplier || "—"}
                            </td>
                            <td className="py-3 px-4 text-right font-bold text-red-600 dark:text-red-400 whitespace-nowrap">
                              - {formatFCFA(e.amount)}
                            </td>
                            {isAdmin && (
                              <td className="py-3 px-4 text-center whitespace-nowrap">
                                <button
                                  onClick={() => handleDeleteExpense(e.id)}
                                  disabled={deletingId === e.id}
                                  title="Supprimer la dépense"
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition-colors"
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
    </PullToRefresh>
  );
}
