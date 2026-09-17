"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import {
  WalletCards,
  ArrowDownRight,
  ArrowUpRight,
  Lock,
  Plus,
  RefreshCw,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  Banknote,
  Smartphone,
  CreditCard,
  Building2,
  Calendar,
  Filter,
  Eye,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import { OpenSessionModal } from "@/components/cash/open-session-modal";
import { CloseSessionModal } from "@/components/cash/close-session-modal";
import { CashMovementModal } from "@/components/cash/cash-movement-modal";
import { ZTicketModal } from "@/components/cash/z-ticket-modal";
import { formatFCFA, getCategoryLabel } from "@/lib/cash";

export default function CashManagementPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const [tab, setTab] = useState<"live" | "history" | "journal" | "registers">("live");

  // Registers
  const [registers, setRegisters] = useState<any[]>([]);
  const [selectedRegisterId, setSelectedRegisterId] = useState<string>("");

  // Active Session
  const [activeSessionData, setActiveSessionData] = useState<any>(null);
  const [loadingActive, setLoadingActive] = useState(true);

  // Modals
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementInitialType, setMovementInitialType] = useState<"CASH_IN" | "CASH_OUT">("CASH_OUT");
  const [selectedZSessionId, setSelectedZSessionId] = useState<string | null>(null);

  // History state
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);

  // Journal state
  const [journalMovements, setJournalMovements] = useState<any[]>([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalFilterType, setJournalFilterType] = useState<string>("");

  // Tenant settings state
  const [requireSessionSetting, setRequireSessionSetting] = useState(false);
  const [savingSetting, setSavingSetting] = useState(false);

  // New register modal
  const [showNewRegisterModal, setShowNewRegisterModal] = useState(false);
  const [newRegisterForm, setNewRegisterForm] = useState({ name: "", code: "", isDefault: false });
  const [newRegisterError, setNewRegisterError] = useState("");

  // Load Registers
  const loadRegisters = useCallback(async () => {
    try {
      const res = await fetch("/api/cash-registers");
      if (res.ok) {
        const json = await res.json();
        setRegisters(json.data || []);
        if (json.data?.length > 0 && !selectedRegisterId) {
          const def = json.data.find((r: any) => r.isDefault) || json.data[0];
          setSelectedRegisterId(def.id);
        }
      }
    } catch (err) {
      console.error("Failed to load registers", err);
    }
  }, [selectedRegisterId]);

  // Load Active Session
  const loadActiveSession = useCallback(async () => {
    setLoadingActive(true);
    try {
      const url = selectedRegisterId
        ? `/api/cash-sessions/active?registerId=${selectedRegisterId}`
        : "/api/cash-sessions/active";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setActiveSessionData(json.data);
      }
    } catch (err) {
      console.error("Failed to load active session", err);
    } finally {
      setLoadingActive(false);
    }
  }, [selectedRegisterId]);

  // Load History
  const loadHistory = useCallback(async (page: number = 1) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/cash-sessions?page=${page}&limit=15`);
      if (res.ok) {
        const json = await res.json();
        setHistorySessions(json.data.sessions || []);
        setHistoryPage(json.data.pagination?.page || 1);
        setHistoryTotalPages(json.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error("Failed to load history", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // Load Journal
  const loadJournal = useCallback(async () => {
    setJournalLoading(true);
    try {
      const url = journalFilterType
        ? `/api/cash-movements?type=${journalFilterType}&limit=50`
        : "/api/cash-movements?limit=50";
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setJournalMovements(json.data.movements || []);
      }
    } catch (err) {
      console.error("Failed to load journal", err);
    } finally {
      setJournalLoading(false);
    }
  }, [journalFilterType]);

  // Load Tenant Setting
  const loadTenantSetting = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/tenant");
      if (res.ok) {
        const json = await res.json();
        setRequireSessionSetting(Boolean(json.data?.requireOpenSessionForPayment));
      }
    } catch (err) {
      console.error("Failed to load tenant setting", err);
    }
  }, [isAdmin]);

  useEffect(() => {
    loadRegisters();
    loadTenantSetting();
  }, [loadRegisters, loadTenantSetting]);

  useEffect(() => {
    if (tab === "live") loadActiveSession();
    if (tab === "history") loadHistory(1);
    if (tab === "journal") loadJournal();
  }, [tab, loadActiveSession, loadHistory, loadJournal]);

  const handleToggleRequireSession = async () => {
    setSavingSetting(true);
    try {
      const nextValue = !requireSessionSetting;
      const res = await fetch("/api/tenant", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requireOpenSessionForPayment: nextValue }),
      });
      if (res.ok) {
        setRequireSessionSetting(nextValue);
      }
    } catch (err) {
      console.error("Failed to update setting", err);
    } finally {
      setSavingSetting(false);
    }
  };

  const handleCreateRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewRegisterError("");
    try {
      const res = await fetch("/api/cash-registers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newRegisterForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur création caisse");

      setShowNewRegisterModal(false);
      setNewRegisterForm({ name: "", code: "", isDefault: false });
      loadRegisters();
    } catch (err: any) {
      setNewRegisterError(err.message);
    }
  };

  const activeSession = activeSessionData?.hasActiveSession ? activeSessionData.session : null;
  const summary = activeSession?.summary;

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white flex items-center justify-center shadow-lg shadow-teal-600/20">
            <WalletCards className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Gestion des Caisses</h1>
            <p className="text-xs text-gray-500 font-medium">
              Suivi des vacations, décaissements et traçabilité comptable
            </p>
          </div>
        </div>

        {/* Global Action: Open Register if closed */}
        {!activeSession && !loadingActive && (
          <button
            onClick={() => setShowOpenModal(true)}
            className="px-4 py-2.5 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-bold text-sm rounded-2xl shadow-md shadow-teal-700/20 hover:from-teal-700 hover:to-teal-800 flex items-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Ouvrir une Caisse</span>
          </button>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200/80 pb-1 overflow-x-auto">
        <button
          onClick={() => setTab("live")}
          className={`px-4 py-2.5 text-sm font-bold rounded-2xl transition flex items-center gap-2 shrink-0 ${
            tab === "live"
              ? "bg-teal-50 text-teal-700 shadow-sm"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Banknote className="w-4 h-4" />
          <span>Caisse en Direct</span>
          {activeSession && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setTab("history")}
          className={`px-4 py-2.5 text-sm font-bold rounded-2xl transition flex items-center gap-2 shrink-0 ${
            tab === "history"
              ? "bg-teal-50 text-teal-700 shadow-sm"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Historique & Tickets Z</span>
        </button>

        <button
          onClick={() => setTab("journal")}
          className={`px-4 py-2.5 text-sm font-bold rounded-2xl transition flex items-center gap-2 shrink-0 ${
            tab === "journal"
              ? "bg-teal-50 text-teal-700 shadow-sm"
              : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Journal Comptable</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setTab("registers")}
            className={`px-4 py-2.5 text-sm font-bold rounded-2xl transition flex items-center gap-2 shrink-0 ${
              tab === "registers"
                ? "bg-teal-50 text-teal-700 shadow-sm"
                : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Paramètres Caisses</span>
          </button>
        )}
      </div>

      {/* ─── TAB 1: LIVE REGISTER ─── */}
      {tab === "live" && (
        <div className="space-y-6">
          {loadingActive ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <div className="w-10 h-10 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-gray-400 text-sm font-medium">Chargement de la vacation...</p>
            </div>
          ) : activeSession ? (
            <>
              {/* Active Session Banner */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-teal-900 via-teal-800 to-gray-900 text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs uppercase tracking-wider border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      Session Ouverte
                    </span>
                    <span className="text-teal-200 text-xs font-semibold">
                      Vacation #{activeSession.sessionNumber}
                    </span>
                  </div>
                  <h2 className="text-xl font-black">{activeSession.register?.name}</h2>
                  <p className="text-xs text-teal-200/80">
                    Ouverte par <span className="font-bold text-white">{activeSession.openedBy?.name}</span> le{" "}
                    {new Date(activeSession.openedAt).toLocaleString("fr-FR")}
                  </p>
                </div>

                {/* Quick Action Buttons */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => {
                      setMovementInitialType("CASH_OUT");
                      setShowMovementModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/30 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <ArrowDownRight className="w-4 h-4 text-rose-400" />
                    <span>Dépense / Sortie</span>
                  </button>

                  <button
                    onClick={() => {
                      setMovementInitialType("CASH_IN");
                      setShowMovementModal(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    <span>Apport de fonds</span>
                  </button>

                  <button
                    onClick={() => setSelectedZSessionId(activeSession.id)}
                    className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-1.5 transition"
                  >
                    <FileText className="w-4 h-4 text-amber-300" />
                    <span>Ticket X (Lecture)</span>
                  </button>

                  <button
                    onClick={() => setShowCloseModal(true)}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-gray-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-600/20 transition"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Clôturer Caisse (Ticket Z)</span>
                  </button>
                </div>
              </div>

              {/* 4 Financial KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Fond initial */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Fond Initial</span>
                    <Banknote className="w-4 h-4 text-gray-400" />
                  </div>
                  <p className="text-2xl font-black text-gray-800">
                    {formatFCFA(summary.openingAmount)}
                  </p>
                  <p className="text-[11px] text-gray-400">Monnaie au démarrage</p>
                </div>

                {/* 2. Recettes Encaissées */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Recettes Commandes</span>
                    <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                      {summary.salesCount} ventes
                    </span>
                  </div>
                  <p className="text-2xl font-black text-teal-700">
                    {formatFCFA(summary.totalSales)}
                  </p>
                  <div className="flex items-center gap-2 text-[10px] text-gray-500 font-semibold pt-1 border-t border-gray-100">
                    <span>Esp: {formatFCFA(summary.totalCashSales)}</span>
                    <span>• Wave: {formatFCFA(summary.totalWaveSales)}</span>
                    <span>• OM: {formatFCFA(summary.totalOmSales)}</span>
                  </div>
                </div>

                {/* 3. Dépenses / Sorties */}
                <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-1">
                  <div className="flex items-center justify-between text-gray-400">
                    <span className="text-xs font-bold uppercase tracking-wider">Dépenses & Sorties</span>
                    <ArrowDownRight className="w-4 h-4 text-rose-500" />
                  </div>
                  <p className="text-2xl font-black text-rose-600">
                    {formatFCFA(summary.manualCashOut)}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    Achats consommables, courses, etc.
                  </p>
                </div>

                {/* 4. Solde Théorique Actuel */}
                <div className="bg-gradient-to-br from-teal-500 to-teal-700 text-white p-5 rounded-3xl shadow-lg shadow-teal-700/20 space-y-1">
                  <div className="flex items-center justify-between text-teal-100">
                    <span className="text-xs font-bold uppercase tracking-wider">Solde Théorique Caisse</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-black">
                    {formatFCFA(summary.expectedCash)}
                  </p>
                  <p className="text-[11px] text-teal-100/90">
                    Espèces physiques attendues dans le tiroir
                  </p>
                </div>
              </div>

              {/* Transactions in this shift */}
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                    Flux de la Vacation en Direct
                  </h3>
                  <span className="text-xs text-gray-400 font-medium">
                    {activeSession.payments.length + activeSession.movements.length} opérations
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {/* Unified list of operations */}
                  {(() => {
                    const combined = [
                      ...activeSession.payments.map((p: any) => ({
                        type: "PAYMENT",
                        date: new Date(p.createdAt),
                        title: `Paiement Commande ${p.order?.code || ""}`,
                        subtitle: p.order?.customer?.name || "Client",
                        method: p.method,
                        amount: p.amount,
                        isCredit: true,
                        note: p.note,
                      })),
                      ...activeSession.movements.map((m: any) => ({
                        type: "MOVEMENT",
                        date: new Date(m.createdAt),
                        title: m.reason,
                        subtitle: `${getCategoryLabel(m.category)} ${m.beneficiary ? `• ${m.beneficiary}` : ""}`,
                        method: "CASH",
                        amount: m.amount,
                        isCredit: m.type === "CASH_IN",
                        note: m.receiptRef ? `Justif: ${m.receiptRef}` : null,
                      })),
                    ].sort((a, b) => b.date.getTime() - a.date.getTime());

                    if (combined.length === 0) {
                      return (
                        <div className="p-8 text-center text-gray-400 text-xs font-medium">
                          Aucune opération enregistrée dans cette vacation pour l&apos;instant.
                        </div>
                      );
                    }

                    return combined.map((op, idx) => (
                      <div key={idx} className="px-4 sm:px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-gray-50/60 transition">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                              op.isCredit
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-rose-50 text-rose-600"
                            }`}
                          >
                            {op.isCredit ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-gray-900 truncate">{op.title}</p>
                            <p className="text-[11px] text-gray-400 truncate">
                              {op.subtitle} • {op.date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              {op.note && ` • ${op.note}`}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-sm font-black ${
                              op.isCredit ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {op.isCredit ? `+${formatFCFA(op.amount)}` : `-${formatFCFA(op.amount)}`}
                          </span>
                          <span className="block text-[10px] uppercase font-bold text-gray-400">
                            {op.method}
                          </span>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </>
          ) : (
            /* No Active Session CTA */
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 text-center max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-teal-50 text-teal-600 mx-auto flex items-center justify-center shadow-inner">
                <WalletCards className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">La caisse est actuellement fermée</h2>
                <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                  Ouvrez une session de caisse avec le fond de caisse initial pour démarrer la journée et suivre tous vos encaissements et dépenses.
                </p>
              </div>
              <button
                onClick={() => setShowOpenModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-700 text-white font-bold text-sm rounded-2xl shadow-lg shadow-teal-700/20 hover:from-teal-700 hover:to-teal-800 transition"
              >
                Ouvrir la Caisse Maintenant
              </button>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: HISTORY & Z-REPORTS ─── */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                  Historique des Clôtures & Tickets Z
                </h2>
                <p className="text-xs text-gray-400">
                  Archives certifiées de toutes les vacations passées
                </p>
              </div>
              <button
                onClick={() => loadHistory(historyPage)}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              >
                <RefreshCw className={`w-4 h-4 ${historyLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {historyLoading ? (
              <div className="py-16 text-center text-gray-400 text-xs">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Chargement de l&apos;historique...
              </div>
            ) : historySessions.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-xs">
                Aucune session enregistrée pour le moment.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 text-gray-400 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3.5">Vacation & Réf Z</th>
                      <th className="px-4 py-3.5">Caisse</th>
                      <th className="px-4 py-3.5">Dates / Horaires</th>
                      <th className="px-4 py-3.5">Caissier</th>
                      <th className="px-4 py-3.5 text-right">Fond Initial</th>
                      <th className="px-4 py-3.5 text-right">Espèces Attendues</th>
                      <th className="px-4 py-3.5 text-right">Espèces Comptées</th>
                      <th className="px-4 py-3.5 text-center">Écart</th>
                      <th className="px-6 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {historySessions.map((s) => {
                      const isClosed = s.status === "CLOSED";
                      const diff = s.difference ?? 0;
                      return (
                        <tr key={s.id} className="hover:bg-gray-50/60 transition">
                          <td className="px-6 py-4">
                            <span className="font-bold text-gray-900 block">#{s.sessionNumber}</span>
                            <span className="text-[10px] text-gray-400 font-mono">
                              {s.zReportNumber || "En cours"}
                            </span>
                          </td>
                          <td className="px-4 py-4 font-semibold">{s.register?.name}</td>
                          <td className="px-4 py-4 text-[11px]">
                            <span className="block font-medium">
                              {new Date(s.openedAt).toLocaleDateString("fr-FR")}
                            </span>
                            <span className="text-gray-400">
                              {new Date(s.openedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                              {s.closedAt && ` → ${new Date(s.closedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-[11px]">
                            <span className="font-bold block">{s.openedBy?.name}</span>
                            {s.closedBy && <span className="text-gray-400">Fermé par: {s.closedBy?.name}</span>}
                          </td>
                          <td className="px-4 py-4 text-right font-medium">
                            {formatFCFA(s.openingAmount)}
                          </td>
                          <td className="px-4 py-4 text-right font-bold">
                            {s.expectedCash !== null ? formatFCFA(s.expectedCash) : "-"}
                          </td>
                          <td className="px-4 py-4 text-right font-black">
                            {s.actualCash !== null ? formatFCFA(s.actualCash) : "-"}
                          </td>
                          <td className="px-4 py-4 text-center">
                            {!isClosed ? (
                              <span className="px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 text-[10px] font-bold">
                                EN COURS
                              </span>
                            ) : diff === 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                                0 F (Équilibré)
                              </span>
                            ) : diff < 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold">
                                {formatFCFA(diff)}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold">
                                +{formatFCFA(diff)}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setSelectedZSessionId(s.id)}
                              className="px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-teal-50 hover:text-teal-700 text-gray-700 font-bold text-xs flex items-center gap-1.5 ml-auto transition"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Ticket Z</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 3: JOURNAL & EXPORT ─── */}
      {tab === "journal" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-500">Filtrer par type :</span>
              <select
                value={journalFilterType}
                onChange={(e) => setJournalFilterType(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold focus:ring-2 focus:ring-teal-500 outline-none"
              >
                <option value="">Tous les mouvements</option>
                <option value="CASH_OUT">Dépenses uniquement</option>
                <option value="CASH_IN">Apports uniquement</option>
              </select>
            </div>

            {/* Export CSV Button */}
            <a
              href="/api/cash-reports/export"
              download
              className="px-4 py-2 bg-gradient-to-r from-teal-600 to-teal-700 text-white text-xs font-bold rounded-2xl shadow-md flex items-center gap-2 hover:from-teal-700 hover:to-teal-800 transition"
            >
              <Download className="w-4 h-4" />
              <span>Exporter en CSV (Excel)</span>
            </a>
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                Journal des Mouvements de Caisse
              </h2>
              <span className="text-xs text-gray-400">{journalMovements.length} écritures</span>
            </div>

            {journalLoading ? (
              <div className="py-16 text-center text-gray-400 text-xs">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Chargement du journal...
              </div>
            ) : journalMovements.length === 0 ? (
              <div className="py-16 text-center text-gray-400 text-xs">
                Aucun mouvement de caisse enregistré.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 text-gray-400 uppercase font-bold text-[10px] tracking-wider border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-3.5">Date & Heure</th>
                      <th className="px-4 py-3.5">Type</th>
                      <th className="px-4 py-3.5">Catégorie</th>
                      <th className="px-4 py-3.5">Motif / Description</th>
                      <th className="px-4 py-3.5">Tiers / Bénéficiaire</th>
                      <th className="px-4 py-3.5">Réf Justificatif</th>
                      <th className="px-4 py-3.5">Opérateur</th>
                      <th className="px-6 py-3.5 text-right">Montant</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-gray-700">
                    {journalMovements.map((m) => {
                      const isOut = m.type === "CASH_OUT";
                      return (
                        <tr key={m.id} className="hover:bg-gray-50/60 transition">
                          <td className="px-6 py-3.5 text-[11px] text-gray-500 whitespace-nowrap">
                            {new Date(m.createdAt).toLocaleString("fr-FR")}
                          </td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isOut
                                  ? "bg-rose-50 text-rose-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              {isOut ? "DÉPENSE" : "APPORT"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-gray-800">
                            {getCategoryLabel(m.category)}
                          </td>
                          <td className="px-4 py-3.5 text-gray-600 max-w-xs truncate font-medium">
                            {m.reason}
                          </td>
                          <td className="px-4 py-3.5 text-gray-500">{m.beneficiary || "-"}</td>
                          <td className="px-4 py-3.5 text-gray-400 font-mono text-[10px]">
                            {m.receiptRef || "-"}
                          </td>
                          <td className="px-4 py-3.5 font-medium text-gray-600">
                            {m.createdBy?.name || "Agent"}
                          </td>
                          <td className="px-6 py-3.5 text-right font-black whitespace-nowrap">
                            <span className={isOut ? "text-rose-600" : "text-emerald-600"}>
                              {isOut ? `-${formatFCFA(m.amount)}` : `+${formatFCFA(m.amount)}`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── TAB 4: CAISSES & SETTINGS (ADMIN) ─── */}
      {tab === "registers" && isAdmin && (
        <div className="space-y-6">
          {/* Strict Rule Toggle Card */}
          <div className="bg-white p-4 sm:p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-gray-900">
                Exiger une Vacation Ouverte pour Encaisser en Espèces
              </h3>
              <p className="text-xs text-gray-500 max-w-xl">
                Si activé, les agents ne pourront enregistrer aucun paiement en espèces tant qu&apos;une vacation de caisse n&apos;est pas formellement ouverte. Cela garantit une traçabilité absolue des fonds.
              </p>
            </div>

            <button
              onClick={handleToggleRequireSession}
              disabled={savingSetting}
              className={`w-14 h-8 rounded-full p-1 transition-colors flex items-center shrink-0 self-end sm:self-auto ${
                requireSessionSetting ? "bg-teal-600" : "bg-gray-200"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform ${
                  requireSessionSetting ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Cash Registers List */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-gray-800 uppercase tracking-wider">
                  Postes & Caisses Enregistreuses
                </h3>
                <p className="text-xs text-gray-400">
                  Gérez vos points d&apos;encaissement physiques ou logiques
                </p>
              </div>

              <button
                onClick={() => setShowNewRegisterModal(true)}
                className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nouvelle Caisse</span>
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {registers.map((reg) => (
                <div key={reg.id} className="p-6 flex items-center justify-between hover:bg-gray-50/50 transition">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-black text-xs">
                      {reg.code}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-900">{reg.name}</h4>
                        {reg.isDefault && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                            Par défaut
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            reg.activeSession
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {reg.activeSession ? "Session en cours" : "Fermée"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Code : {reg.code}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── MODALS ─── */}
      {showOpenModal && (
        <OpenSessionModal
          registers={registers}
          onClose={() => setShowOpenModal(false)}
          onSuccess={() => {
            setShowOpenModal(false);
            loadActiveSession();
            loadRegisters();
          }}
        />
      )}

      {showCloseModal && activeSession && (
        <CloseSessionModal
          sessionId={activeSession.id}
          sessionNumber={activeSession.sessionNumber}
          registerName={activeSession.register?.name || "Caisse"}
          expectedCash={summary.expectedCash}
          totalWaveSales={summary.totalWaveSales}
          totalOmSales={summary.totalOmSales}
          onClose={() => setShowCloseModal(false)}
          onSuccess={(closedData) => {
            setShowCloseModal(false);
            loadActiveSession();
            setSelectedZSessionId(closedData.session?.id || activeSession.id);
          }}
        />
      )}

      {showMovementModal && activeSession && (
        <CashMovementModal
          sessionId={activeSession.id}
          initialType={movementInitialType}
          onClose={() => setShowMovementModal(false)}
          onSuccess={() => {
            setShowMovementModal(false);
            loadActiveSession();
          }}
        />
      )}

      {selectedZSessionId && (
        <ZTicketModal
          sessionId={selectedZSessionId}
          onClose={() => setSelectedZSessionId(null)}
        />
      )}

      {/* New Register Modal */}
      {showNewRegisterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Ajouter une Caisse</h3>
            {newRegisterError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl">
                {newRegisterError}
              </p>
            )}
            <form onSubmit={handleCreateRegister} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Nom de la caisse
                </label>
                <input
                  type="text"
                  placeholder="Ex : Caisse Comptoir 2"
                  value={newRegisterForm.name}
                  onChange={(e) => setNewRegisterForm({ ...newRegisterForm, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-teal-500 outline-none"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  Code court (ex: CS-02)
                </label>
                <input
                  type="text"
                  placeholder="CS-02"
                  value={newRegisterForm.code}
                  onChange={(e) =>
                    setNewRegisterForm({ ...newRegisterForm, code: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:ring-2 focus:ring-teal-500 outline-none uppercase"
                  required
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="regDefault"
                  checked={newRegisterForm.isDefault}
                  onChange={(e) =>
                    setNewRegisterForm({ ...newRegisterForm, isDefault: e.target.checked })
                  }
                  className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <label htmlFor="regDefault" className="text-xs text-gray-600 font-medium">
                  Définir comme caisse principale par défaut
                </label>
              </div>

              <div className="flex items-center gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setShowNewRegisterModal(false)}
                  className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold"
                >
                  Créer la caisse
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
