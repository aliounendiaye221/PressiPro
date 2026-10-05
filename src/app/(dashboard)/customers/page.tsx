"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  UserPlus,
  Users,
  ChevronLeft,
  ChevronRight,
  WifiOff,
  Phone,
  MessageCircle,
  Crown,
  Sparkles,
  ShoppingBag,
} from "lucide-react";
import { formatOfflineCacheTime, readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";
import { createOfflineTempId, enqueueOfflineAction } from "@/lib/offline-queue";
import { CustomerSparkline } from "@/components/customer-sparkline";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { triggerHaptic, playFeedbackSound } from "@/lib/feedback";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;
  totalOrders?: number;
  spendingTrend?: number[];
  totalSpent?: number;
}

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

function cleanPhoneForWhatsApp(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, "");
  if (cleaned.startsWith("221")) return cleaned;
  if (cleaned.length === 9) return "221" + cleaned;
  return cleaned;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isOffline, setIsOffline] = useState(false);
  const [usingCache, setUsingCache] = useState(false);
  const [cacheUpdatedAt, setCacheUpdatedAt] = useState<string | null>(null);

  // New customer form
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newError, setNewError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsOffline(!navigator.onLine);
    const syncNetworkState = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);

    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    params.set("page", String(page));
    const cacheKey = `customers:${params.toString()}`;

    try {
      const res = await fetch(`/api/customers?${params}`);
      if (!res.ok) {
        throw new Error("customers-fetch-failed");
      }

      const data = await res.json();
      setCustomers(data.customers || []);
      setTotal(data.total || 0);
      setUsingCache(false);
      setCacheUpdatedAt(new Date().toISOString());
      writeOfflineCache(cacheKey, { customers: data.customers || [], total: data.total || 0 });
    } catch {
      const cached = readOfflineCache<{ customers: Customer[]; total: number }>(cacheKey);
      if (cached) {
        setCustomers(cached.data.customers || []);
        setTotal(cached.data.total || 0);
        setUsingCache(true);
        setCacheUpdatedAt(cached.updatedAt);
      } else {
        setCustomers([]);
        setTotal(0);
      }
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  const handleRefresh = async () => {
    triggerHaptic("medium");
    await fetchCustomers();
    playFeedbackSound("success");
  };

  const createCustomer = async () => {
    setNewError("");
    setSyncMessage("");

    if (!newName.trim()) {
      setNewError("Le nom du client est requis.");
      return;
    }
    if (!newPhone.trim()) {
      setNewError("Le numéro de téléphone est requis.");
      return;
    }

    const payload = { name: newName.trim(), phone: newPhone.trim() };
    const queueCustomer = () => {
      const tempId = createOfflineTempId("customer");
      enqueueOfflineAction({
        type: "CREATE_CUSTOMER",
        request: {
          url: "/api/customers",
          method: "POST",
          body: payload,
        },
        meta: { tempCustomerId: tempId },
      });

      setCustomers((prev) => [
        {
          id: tempId,
          name: payload.name,
          phone: payload.phone,
          createdAt: new Date().toISOString(),
          totalOrders: 0,
          totalSpent: 0,
          spendingTrend: [],
        },
        ...prev,
      ]);
      setTotal((prev) => prev + 1);
      setShowNew(false);
      setNewName("");
      setNewPhone("");
      setSyncMessage("Client enregistré hors ligne. Il sera synchronisé dès le retour de la connexion.");
      triggerHaptic("success");
      playFeedbackSound("success");
    };

    if (!navigator.onLine) {
      queueCustomer();
      return;
    }

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setNewError(data.error || "Erreur lors de la création.");
        triggerHaptic("error");
        playFeedbackSound("error");
        return;
      }
      setShowNew(false);
      setNewName("");
      setNewPhone("");
      triggerHaptic("success");
      playFeedbackSound("success");
      fetchCustomers();
    } catch {
      queueCustomer();
    }
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6">
        {(isOffline || usingCache) && (
          <div className="flex items-center gap-2 rounded-2xl border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>
              Clients chargés depuis le cache local
              {formatOfflineCacheTime(cacheUpdatedAt) ? ` du ${formatOfflineCacheTime(cacheUpdatedAt)}` : ""}.
            </span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>Clients</span>
              <span className="text-xs bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 px-2.5 py-0.5 rounded-full font-semibold border border-primary-200/50 dark:border-primary-800/40">
                {total}
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              Gestion du répertoire, historique de dépenses et fidélité
            </p>
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              triggerHaptic("light");
              setShowNew(true);
            }}
          >
            <UserPlus className="w-4 h-4" /> Nouveau client
          </button>
        </div>

        {/* Quick Add Form Modal / Card */}
        {showNew && (
          <div className="card space-y-3 border-2 border-primary-200 dark:border-primary-800/60 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-600" />
                <span>Nouveau client</span>
              </h2>
            </div>
            {newError && (
              <p className="text-red-500 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/30 p-2.5 rounded-xl border border-red-200 dark:border-red-900/40">
                {newError}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                placeholder="Nom complet *"
                className="input-field"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <input
                placeholder="Téléphone (ex: 77 123 45 67) *"
                className="input-field"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                className="btn-secondary text-xs"
                onClick={() => setShowNew(false)}
              >
                Annuler
              </button>
              <button className="btn-primary text-xs" onClick={createCustomer}>
                Enregistrer le client
              </button>
            </div>
          </div>
        )}

        {syncMessage && (
          <div className="rounded-2xl border border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/40 px-4 py-3 text-sm text-sky-800 dark:text-sky-300">
            {syncMessage}
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-slate-500" />
          <input
            type="search"
            placeholder="Rechercher par nom ou numéro de téléphone..."
            className="input-field pl-10"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {/* List Content */}
        {loading ? (
          <div className="grid gap-2.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="card flex items-center gap-4 py-4 animate-pulse dark:bg-slate-900/60"
              >
                <div className="w-11 h-11 rounded-xl skeleton shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-36 skeleton rounded" />
                  <div className="h-3 w-24 skeleton rounded" />
                </div>
                <div className="hidden sm:block h-6 w-20 skeleton rounded" />
                <div className="h-6 w-16 skeleton rounded-full" />
              </div>
            ))}
          </div>
        ) : customers.length === 0 ? (
          <div className="card text-center py-16 dark:bg-slate-900/40">
            <Users className="w-12 h-12 text-gray-300 dark:text-slate-600 mx-auto mb-3" />
            <p className="text-gray-600 dark:text-slate-300 font-medium">Aucun client trouvé</p>
            <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
              Ajoutez votre premier client pour commencer à enregistrer des dépôts
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-2.5">
              {customers.map((c) => {
                const totalSpent = c.totalSpent || 0;
                const totalOrders = c.totalOrders || 0;
                const isVIP = totalSpent >= 40000 || totalOrders >= 8;
                const isRegular = totalOrders >= 3 && !isVIP;
                const trend = c.spendingTrend || [];

                return (
                  <div
                    key={c.id}
                    className="group card hover:shadow-md hover:border-primary-200 dark:hover:border-primary-800/60 transition-all duration-200 flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 sm:p-4 bg-white dark:bg-slate-900/80"
                  >
                    {/* Customer identity avatar & info */}
                    <Link
                      href={`/customers/${c.id}`}
                      className="flex-1 flex items-center gap-3.5 min-w-0"
                    >
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-sm">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        {isVIP && (
                          <span
                            className="absolute -top-1.5 -right-1.5 bg-amber-400 text-amber-950 p-0.5 rounded-full shadow-xs"
                            title="Client VIP"
                          >
                            <Crown className="w-3 h-3 fill-current" />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {c.name}
                          </p>
                          {isVIP && (
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/50 dark:border-amber-800/40">
                              VIP
                            </span>
                          )}
                          {isRegular && (
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/50 text-primary-700 dark:text-primary-300 border border-primary-200/50 dark:border-primary-800/30">
                              Fidèle
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1 font-mono">
                            <Phone className="w-3 h-3 opacity-60" />
                            {c.phone}
                          </span>
                          <span className="opacity-40">·</span>
                          <span className="flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3 opacity-60" />
                            {totalOrders} commande{totalOrders > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                    </Link>

                    {/* Sparkline & Revenue Trajectory */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-slate-800/60 shrink-0">
                      {/* Spending Sparkline */}
                      <div className="flex flex-col items-start sm:items-end">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
                            Dépenses
                          </span>
                          <CustomerSparkline data={trend} width={64} height={20} />
                        </div>
                        <span className="text-xs font-black text-gray-900 dark:text-white mt-0.5">
                          {formatFCFA(totalSpent)}
                        </span>
                      </div>

                      {/* Action buttons: WhatsApp & Detail */}
                      <div className="flex items-center gap-1.5 ml-2">
                        <a
                          href={`https://wa.me/${cleanPhoneForWhatsApp(c.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            triggerHaptic("medium");
                          }}
                          className="p-2 rounded-xl text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200/60 dark:border-emerald-800/50 transition-colors shadow-2xs active:scale-95"
                          title={`Contacter ${c.name} sur WhatsApp`}
                        >
                          <MessageCircle className="w-4 h-4" />
                        </a>

                        <Link
                          href={`/customers/${c.id}`}
                          className="p-2 rounded-xl text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                          title="Voir la fiche client"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
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
                  <ChevronLeft className="w-4 h-4" /> Précédent
                </button>
                <span className="text-sm text-gray-500 dark:text-slate-400 px-3">
                  Page {page} / {Math.ceil(total / 20)}
                </span>
                <button
                  className="btn-secondary text-sm"
                  disabled={page * 20 >= total}
                  onClick={() => {
                    triggerHaptic("light");
                    setPage((p) => p + 1);
                  }}
                >
                  Suivant <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </PullToRefresh>
  );
}
