"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import {
  createOfflineTempId,
  enqueueOfflineAction,
  findQueuedActionByTempEntityId,
  removeOfflineQueueItem,
} from "@/lib/offline-queue";
import { readOfflineCache, writeOfflineCache } from "@/lib/offline-cache";
import {
  ArrowLeft,
  ChevronRight,
  Plus,
  Printer,
  Copy,
  MessageCircle,
  Undo2,
  AlertTriangle,
  CalendarClock,
  StickyNote,
  User,
  Banknote,
  History,
  Download,
  Trash2,
  Pencil,
  Save,
  X,
  Clock3,
  CheckCircle2,
  Truck,
  Inbox,
  TerminalSquare,
} from "lucide-react";
import { printDirectlyPOS } from "@/lib/receipt/escpos";

interface OrderDetail {
  id: string;
  code: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  notes: string | null;
  promisedAt: string | null;
  createdAt: string;
  customer: { id: string; name: string; phone: string; email?: string };
  items: { id: string; name: string; quantity: number; unitPrice: number; total: number }[];
  payments: { id: string; amount: number; method: string; createdAt: string; note?: string }[];
  statusHistory: { id: string; fromStatus: string | null; toStatus: string; createdAt: string; note?: string }[];
}

const ORDER_DETAIL_CACHE_KEY_PREFIX = "order-detail:";

function formatFCFA(n: number) {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " F";
}

function normalizeWhatsAppNumber(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return null;

  let cleaned = digits;
  if (cleaned.startsWith("+")) {
    cleaned = cleaned.slice(1);
  } else if (cleaned.startsWith("00")) {
    cleaned = cleaned.slice(2);
  }

  if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = `221${cleaned.slice(1)}`;
  } else if (!cleaned.startsWith("221") && cleaned.length === 9) {
    cleaned = `221${cleaned}`;
  }

  if (!/^\d{11,15}$/.test(cleaned)) {
    return null;
  }

  return cleaned;
}

const STATUS_LABELS: Record<string, string> = {
  RECU: "Reçu", TRAITEMENT: "En traitement", PRET: "Prêt", LIVRE: "Livré",
};
const STATUS_COLORS: Record<string, string> = {
  RECU: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/10", TRAITEMENT: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/10",
  PRET: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10", LIVRE: "bg-gray-100 text-gray-600 ring-1 ring-gray-500/10",
};
const NEXT_STATUS: Record<string, string> = {
  RECU: "TRAITEMENT", TRAITEMENT: "PRET", PRET: "LIVRE",
};
const STATUS_FLOW = ["RECU", "TRAITEMENT", "PRET", "LIVRE"] as const;
const STATUS_ACTIONS: Record<string, { label: string; helper: string; icon: typeof Inbox }> = {
  RECU: {
    label: "Passer en traitement",
    helper: "La commande quitte l'accueil et entre dans l'atelier.",
    icon: Clock3,
  },
  TRAITEMENT: {
    label: "Marquer prête",
    helper: "Utilisez cette action quand les articles sont terminés.",
    icon: CheckCircle2,
  },
  PRET: {
    label: "Marquer livrée",
    helper: "Confirmez la remise au client.",
    icon: Truck,
  },
};
const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces", OM: "Orange Money", WAVE: "Wave", OTHER: "Autre",
};

function buildWhatsAppUrl(normalizedPhone: string, message: string) {
  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [directPrintLoading, setDirectPrintLoading] = useState(false);

  // Payment form
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");

  // Edit states
  const [editingNotes, setEditingNotes] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editingDate, setEditingDate] = useState(false);
  const [editDate, setEditDate] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [editError, setEditError] = useState("");
  const [syncMessage, setSyncMessage] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetch(`/api/orders/${id}`);
      if (res.ok) {
        const data = (await res.json()) as OrderDetail;
        setOrder(data);
        writeOfflineCache(`${ORDER_DETAIL_CACHE_KEY_PREFIX}${id}`, data);
      } else {
        throw new Error("fetch-order-failed");
      }
    } catch {
      const cached = readOfflineCache<OrderDetail>(`${ORDER_DETAIL_CACHE_KEY_PREFIX}${id}`);
      if (cached) {
        setOrder(cached.data);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setIsOffline(!navigator.onLine);
    const syncNetworkState = () => setIsOffline(!navigator.onLine);
    window.addEventListener("online", syncNetworkState);
    window.addEventListener("offline", syncNetworkState);

    fetchOrder();

    return () => {
      window.removeEventListener("online", syncNetworkState);
      window.removeEventListener("offline", syncNetworkState);
    };
  }, [fetchOrder]);

  const queueStatusChange = (nextStatus: string) => {
    if (!order) return;

    const previousStatus = order.status;
    enqueueOfflineAction({
      type: "UPDATE_ORDER_STATUS",
      request: {
        url: `/api/orders/${id}/status`,
        method: "PUT",
        body: { status: nextStatus },
      },
    });

    setOrder((prev) =>
      prev
        ? {
          ...prev,
          status: nextStatus,
          statusHistory: [
            ...prev.statusHistory,
            {
              id: createOfflineTempId(),
              fromStatus: previousStatus,
              toStatus: nextStatus,
              createdAt: new Date().toISOString(),
              note: "En attente de synchronisation",
            },
          ],
        }
        : prev
    );
    writeOfflineCache(`${ORDER_DETAIL_CACHE_KEY_PREFIX}${id}`, {
      ...(order ?? {}),
      status: nextStatus,
      statusHistory: [
        ...order.statusHistory,
        {
          id: createOfflineTempId(),
          fromStatus: order.status,
          toStatus: nextStatus,
          createdAt: new Date().toISOString(),
          note: "En attente de synchronisation",
        },
      ],
    } as OrderDetail);
    setSyncMessage("Changement de statut enregistre hors ligne. Il sera rejoue automatiquement.");
  };

  const queuePayment = (amount: number, method: string) => {
    if (!order) return;

    const tempPaymentId = createOfflineTempId();

    enqueueOfflineAction({
      type: "ADD_PAYMENT",
      request: {
        url: `/api/orders/${id}/payments`,
        method: "POST",
        body: { amount, method },
      },
      meta: { tempEntityId: tempPaymentId },
    });

    setOrder((prev) =>
      prev
        ? {
          ...prev,
          paidAmount: Math.min(prev.totalAmount, prev.paidAmount + amount),
          payments: [
            {
              id: tempPaymentId,
              amount,
              method,
              createdAt: new Date().toISOString(),
            },
            ...prev.payments,
          ],
        }
        : prev
    );
    writeOfflineCache(`${ORDER_DETAIL_CACHE_KEY_PREFIX}${id}`, {
      ...(order ?? {}),
      paidAmount: Math.min(order.paidAmount + amount, order.totalAmount),
      payments: [
        {
          id: tempPaymentId,
          amount,
          method,
          createdAt: new Date().toISOString(),
        },
        ...order.payments,
      ],
    } as OrderDetail);
    setShowPayment(false);
    setPayAmount(0);
    setSyncMessage("Paiement enregistre hors ligne. Il sera rejoue automatiquement.");
  };

  const queueOrderFieldUpdate = (changes: { notes?: string | null; promisedAt?: string | null }, successMessage: string) => {
    if (!order) return;

    enqueueOfflineAction({
      type: "UPDATE_ORDER_FIELDS",
      request: {
        url: `/api/orders/${id}`,
        method: "PUT",
        body: changes,
      },
    });

    const nextOrder: OrderDetail = {
      ...order,
      ...(changes.notes !== undefined ? { notes: changes.notes } : {}),
      ...(changes.promisedAt !== undefined ? { promisedAt: changes.promisedAt } : {}),
    };
    setOrder(nextOrder);
    writeOfflineCache(`${ORDER_DETAIL_CACHE_KEY_PREFIX}${id}`, nextOrder);
    setSyncMessage(successMessage);
  };

  const queueDeletePayment = (paymentId: string) => {
    if (!order) return;

    const payment = order.payments.find((entry) => entry.id === paymentId);
    if (!payment) return;

    if (paymentId.startsWith("offline-")) {
      const queuedAction = findQueuedActionByTempEntityId(paymentId);
      if (queuedAction) {
        removeOfflineQueueItem(queuedAction.id);
      }
    } else {
      enqueueOfflineAction({
        type: "DELETE_PAYMENT",
        request: {
          url: `/api/orders/${id}/payments`,
          method: "DELETE",
          body: { paymentId },
        },
      });
    }

    const nextOrder: OrderDetail = {
      ...order,
      paidAmount: Math.max(0, order.paidAmount - payment.amount),
      payments: order.payments.filter((entry) => entry.id !== paymentId),
    };
    setOrder(nextOrder);
    writeOfflineCache(`${ORDER_DETAIL_CACHE_KEY_PREFIX}${id}`, nextOrder);
    setSyncMessage(
      paymentId.startsWith("offline-")
        ? "Paiement local retire de la file d'attente."
        : "Suppression du paiement enregistree hors ligne. Elle sera rejouee automatiquement."
    );
  };

  const queueDeleteOrder = () => {
    if (!order) return;

    enqueueOfflineAction({
      type: "DELETE_ORDER",
      request: {
        url: `/api/orders/${id}`,
        method: "DELETE",
        body: {},
      },
    });
    router.push("/orders");
  };

  const advanceStatus = async () => {
    if (!order) return;
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setEditError("");
    setActionLoading(true);

    if (!navigator.onLine) {
      queueStatusChange(next);
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setEditError(data?.error || "Erreur");
        return;
      }

      await fetchOrder();
    } catch {
      queueStatusChange(next);
    } finally {
      setActionLoading(false);
    }
  };

  const rollbackStatus = async () => {
    if (!order) return;
    const rollbacks: Record<string, string> = {
      TRAITEMENT: "RECU", PRET: "TRAITEMENT", LIVRE: "PRET",
    };
    const prev = rollbacks[order.status];
    if (!prev) return;
    setEditError("");
    setActionLoading(true);

    if (!navigator.onLine) {
      queueStatusChange(prev);
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/orders/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: prev }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setEditError(data?.error || "Erreur");
        return;
      }

      await fetchOrder();
    } catch {
      queueStatusChange(prev);
    } finally {
      setActionLoading(false);
    }
  };

  const addPayment = async () => {
    if (!order || payAmount <= 0) return;
    setEditError("");
    setActionLoading(true);

    if (!navigator.onLine) {
      queuePayment(payAmount, payMethod);
      setActionLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/orders/${id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: payAmount, method: payMethod }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setEditError(data?.error || "Erreur");
        return;
      }

      setShowPayment(false);
      setPayAmount(0);
      await fetchOrder();
    } catch {
      queuePayment(payAmount, payMethod);
    } finally {
      setActionLoading(false);
    }
  };

  const saveNotes = async () => {
    setEditError("");
    setActionLoading(true);
    if (!navigator.onLine) {
      queueOrderFieldUpdate({ notes: editNotes }, "Notes enregistrees hors ligne. Elles seront synchronisees automatiquement.");
      setEditingNotes(false);
      setActionLoading(false);
      return;
    }

    const res = await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: editNotes }),
    });
    if (res.ok) {
      setEditingNotes(false);
      await fetchOrder();
    } else {
      const data = await res.json();
      setEditError(data.error || "Erreur");
    }
    setActionLoading(false);
  };

  const savePromisedAt = async () => {
    setEditError("");
    setActionLoading(true);
    if (!navigator.onLine) {
      queueOrderFieldUpdate({ promisedAt: editDate || null }, "Date promise enregistree hors ligne. Elle sera synchronisee automatiquement.");
      setEditingDate(false);
      setActionLoading(false);
      return;
    }

    const res = await fetch(`/api/orders/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ promisedAt: editDate || null }),
    });
    if (res.ok) {
      setEditingDate(false);
      await fetchOrder();
    } else {
      const data = await res.json();
      setEditError(data.error || "Erreur");
    }
    setActionLoading(false);
  };

  const deleteOrder = async () => {
    setEditError("");
    setActionLoading(true);
    if (!navigator.onLine) {
      if (order && order.paidAmount > 0) {
        setEditError("Suppression hors ligne reservee aux commandes sans paiement.");
        setActionLoading(false);
        return;
      }
      queueDeleteOrder();
      setActionLoading(false);
      return;
    }

    const res = await fetch(`/api/orders/${id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/orders");
    } else {
      const data = await res.json();
      setEditError(data.error || "Erreur lors de la suppression");
      setDeleteConfirm(false);
    }
    setActionLoading(false);
  };

  const deletePayment = async (paymentId: string) => {
    setEditError("");
    setActionLoading(true);
    if (!navigator.onLine) {
      queueDeletePayment(paymentId);
      setActionLoading(false);
      return;
    }

    const res = await fetch(`/api/orders/${id}/payments`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentId }),
    });
    if (res.ok) {
      await fetchOrder();
    } else {
      const data = await res.json();
      setEditError(data.error || "Erreur");
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!order) {
    return <div className="card text-center py-12 text-gray-500">Commande introuvable</div>;
  }

  const amountDue = order.totalAmount - order.paidAmount;
  const paymentStatus = amountDue <= 0 ? "PAYE" : order.paidAmount > 0 ? "PARTIEL" : "IMPAYE";
  const isLate = order.promisedAt && new Date(order.promisedAt) < new Date() && order.status !== "LIVRE";
  const nextStatus = NEXT_STATUS[order.status];
  const nextAction = nextStatus ? STATUS_ACTIONS[order.status] : null;


  const buildWhatsAppMessage = (kind: "receipt" | "ready", receiptShareUrl: string) => {
    const customerName = order.customer.name;
    const lines: string[] = [];

    lines.push(`Bonjour ${customerName},`);
    lines.push("");

    if (kind === "ready") {
      lines.push(`✅ Votre commande *${order.code}* est prête pour le retrait.`);
    } else {
      lines.push(`🧾 Votre dépôt *${order.code}* est bien enregistré.`);
    }

    lines.push(`Total: ${formatFCFA(order.totalAmount)}`);
    lines.push(`Déjà payé: ${formatFCFA(order.paidAmount)}`);

    if (amountDue <= 0) {
      lines.push("Statut paiement: entièrement réglé.");
    } else if (order.paidAmount > 0) {
      lines.push(`Statut paiement: acompte reçu, reste ${formatFCFA(amountDue)}.`);
    } else {
      lines.push(`Statut paiement: dépôt non réglé, montant dû ${formatFCFA(amountDue)}.`);
    }

    lines.push("");
    lines.push(`📄 Reçu sécurisé: ${receiptShareUrl}`);
    lines.push("Le lien permet d'ouvrir et de télécharger le reçu directement.");
    lines.push("");
    lines.push("Merci de votre confiance.");

    return lines.join("\n");
  };

  const sendWhatsAppDirect = async (kind: "receipt" | "ready") => {
    setShareLoading(true);
    setEditError("");
    setSyncMessage("");

    try {
      if (!order.customer.phone?.trim()) {
        setEditError("Aucun numéro client trouvé sur cette commande.");
        return;
      }

      const normalizedPhone = normalizeWhatsAppNumber(order.customer.phone);
      if (!normalizedPhone) {
        setEditError("Numéro client invalide. Corrigez le numéro avant l'envoi WhatsApp.");
        return;
      }

      const linkRes = await fetch(`/api/orders/${order.id}/receipt-share`, {
        cache: "no-store",
      });
      const linkData = await linkRes.json().catch(() => null);
      if (!linkRes.ok || !linkData?.shareUrl) {
        throw new Error(linkData?.error || "Reçu indisponible pour le partage");
      }

      const message = buildWhatsAppMessage(kind, linkData.shareUrl as string);
      const popup = window.open(
        buildWhatsAppUrl(normalizedPhone, message),
        "_blank",
        "noopener,noreferrer"
      );

      if (!popup) {
        setEditError("Le navigateur a bloqué l'ouverture de WhatsApp. Autorisez les popups puis réessayez.");
        return;
      }

      setSyncMessage("Conversation WhatsApp ouverte directement avec le bon client.");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Impossible d'ouvrir WhatsApp avec le reçu.");
    } finally {
      setShareLoading(false);
    }
  };

  const handleDirectPrint = async (isDuplicate = false) => {
    setDirectPrintLoading(true);
    try {
      if (!("serial" in navigator)) {
        setEditError("L'Impression Directe n'est supportée que sur Chrome pc/android (Web Serial API). Veuillez imprimer le reçu PDF classique.");
        return;
      }
      const res = await fetch(`/api/orders/${id}/receipt.pdf?json=1${isDuplicate ? "&duplicate=1" : ""}`);
      if (!res.ok) throw new Error("Impossible de charger les données du reçu");
      const data = await res.json();
      await printDirectlyPOS(data);
      setSyncMessage("Impression thermique commandée avec succès !");
    } catch (e: any) {
      if (e.name === "NotFoundError" || e.name === "NotAllowedError" || e.message?.includes("No port selected")) {
        // User cancelled picker, don't show error
        return;
      }
      setEditError(e.message || "Erreur d'impression série.");
    } finally {
      setDirectPrintLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {isOffline && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Consultation hors ligne active. Les modifications compatibles seront placees en file d'attente.
        </div>
      )}

      {syncMessage && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          {syncMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start sm:items-center gap-2 sm:gap-3 flex-wrap">
        <button onClick={() => router.push("/orders")} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-lg sm:text-2xl font-bold font-mono text-gray-900">{order.code}</h1>
        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          <span className={`badge text-sm sm:text-base px-2.5 sm:px-3 py-0.5 sm:py-1 ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          {paymentStatus === "PAYE" && <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 text-xs sm:text-sm px-2.5 py-0.5 sm:py-1">PAYÉ</span>}
          {paymentStatus === "PARTIEL" && <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-600/10 text-xs sm:text-sm px-2.5 py-0.5 sm:py-1">PARTIEL</span>}
          {paymentStatus === "IMPAYE" && <span className="badge bg-red-50 text-red-700 ring-1 ring-red-600/10 text-xs sm:text-sm px-2.5 py-0.5 sm:py-1">IMPAYÉ</span>}
          {isLate && <span className="badge bg-red-500 text-white text-xs sm:text-sm px-2.5 py-0.5 sm:py-1 shadow-sm shadow-red-500/30">EN RETARD</span>}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left column: details */}
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {/* Customer */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Client</h2>
            </div>
            <p className="font-medium text-gray-900">{order.customer.name}</p>
            <p className="text-sm text-gray-500">{order.customer.phone}</p>
          </div>

          {/* Items */}
          <div className="card">
            <h2 className="font-semibold mb-3">Articles</h2>
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <table className="min-w-[400px] w-full text-sm">
                <thead>
                  <tr className="border-b text-gray-500 text-left">
                    <th className="py-1">Article</th>
                    <th className="py-1 text-center">Qté</th>
                    <th className="py-1 text-right">P.U.</th>
                    <th className="py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-center">{item.quantity}</td>
                      <td className="py-2 text-right">{formatFCFA(item.unitPrice)}</td>
                      <td className="py-2 text-right font-medium">{formatFCFA(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td colSpan={3} className="py-2">TOTAL</td>
                    <td className="py-2 text-right text-lg">{formatFCFA(order.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payments history */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Banknote className="w-4 h-4 text-gray-400" />
                <h2 className="font-semibold text-gray-900">Paiements</h2>
              </div>
              {amountDue > 0 && (
                <button className="btn-primary text-xs" onClick={() => setShowPayment(true)}>
                  <Plus className="w-3 h-3" /> Paiement
                </button>
              )}
            </div>

            {showPayment && (
              <div className="bg-gray-50 p-3 rounded-lg mb-3 space-y-2">
                <p className="text-sm font-medium">Reste: {formatFCFA(amountDue)}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min={1}
                    max={amountDue}
                    className="input-field"
                    placeholder="Montant"
                    value={payAmount || ""}
                    onChange={(e) => setPayAmount(parseInt(e.target.value) || 0)}
                  />
                  <select className="input-field" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option value="CASH">Espèces</option>
                    <option value="OM">Orange Money</option>
                    <option value="WAVE">Wave</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button className="btn-success text-xs" onClick={addPayment} disabled={actionLoading || payAmount <= 0}>
                    Enregistrer
                  </button>
                  <button className="btn-secondary text-xs" onClick={() => { setShowPayment(false); setPayAmount(0); }}>
                    Annuler
                  </button>
                  {/* Quick amount buttons */}
                  <button className="btn-secondary text-xs" onClick={() => setPayAmount(amountDue)}>
                    Tout payer
                  </button>
                </div>
              </div>
            )}

            {order.payments.length === 0 ? (
              <p className="text-sm text-gray-400">Aucun paiement</p>
            ) : (
              <div className="space-y-2">
                {order.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-sm bg-gray-50 p-2 rounded">
                    <div>
                      <span className="font-medium">{formatFCFA(p.amount)}</span>
                      <span className="text-gray-500 ml-2">{METHOD_LABELS[p.method]}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">
                        {new Date(p.createdAt).toLocaleString("fr-SN", {
                          day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {isAdmin && order.status !== "LIVRE" && (
                        <button onClick={() => deletePayment(p.id)} className="text-red-400 hover:text-red-600 p-1" title="Supprimer ce paiement" disabled={actionLoading}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="border-t mt-3 pt-3 flex justify-between font-semibold">
              <span>Reste à payer</span>
              <span className={amountDue > 0 ? "text-red-600" : "text-green-600"}>
                {formatFCFA(amountDue)}
              </span>
            </div>
          </div>

          {/* Status history */}
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-gray-400" />
              <h2 className="font-semibold text-gray-900">Historique des statuts</h2>
            </div>
            <div className="space-y-2">
              {order.statusHistory.map((h) => (
                <div key={h.id} className="text-sm flex items-center gap-2">
                  <span className="text-gray-400 text-xs w-28 shrink-0">
                    {new Date(h.createdAt).toLocaleString("fr-SN", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  {h.fromStatus && (
                    <>
                      <span className="badge bg-gray-100 text-gray-600 text-xs">{STATUS_LABELS[h.fromStatus]}</span>
                      <span>→</span>
                    </>
                  )}
                  <span className={`badge text-xs ${STATUS_COLORS[h.toStatus]}`}>{STATUS_LABELS[h.toStatus]}</span>
                </div>
              ))}
            </div>
          </div>


        </div>

        {/* Right column: actions */}
        <div className="space-y-4">
          <div className="card space-y-3 lg:sticky lg:top-4">
            <h2 className="font-semibold">Actions</h2>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Parcours commande</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {STATUS_FLOW.map((status, index) => (
                  <div key={status} className="flex items-center gap-2">
                    <span
                      className={`badge px-2.5 py-1 text-xs ${status === order.status ? STATUS_COLORS[status] : "bg-white text-gray-500 ring-1 ring-gray-200"}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                    {index < STATUS_FLOW.length - 1 && (
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Advance status */}
            {nextStatus && nextAction && (
              <div className="rounded-2xl border border-primary-100 bg-primary-50/70 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">Action principale</p>
                <button
                  onClick={advanceStatus}
                  disabled={actionLoading}
                  className="btn-primary mt-3 w-full btn-lg"
                >
                  <nextAction.icon className="h-4 w-4" />
                  {nextAction.label}
                </button>
                <p className="mt-2 text-xs text-primary-700/80">{nextAction.helper}</p>
              </div>
            )}

            {/* Rollback (admin) */}
            {(user?.role === "ADMIN" || user?.role === "SUPER_ADMIN") && order.status !== "RECU" && (
              <button
                onClick={rollbackStatus}
                disabled={actionLoading}
                className="btn-secondary w-full text-xs"
              >
                <Undo2 className="w-3.5 h-3.5" /> Revenir au statut précédent
              </button>
            )}

            {/* Receipt PDF */}
            <button
              onClick={() => handleDirectPrint(false)}
              disabled={directPrintLoading}
              className="btn-primary w-full text-center flex items-center justify-center gap-2"
            >
              <TerminalSquare className="w-4 h-4" /> Impression Directe (Bluetooth/USB)
            </button>

            <a
              href={`/api/orders/${order.id}/receipt.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full text-center block"
            >
              <Printer className="w-4 h-4" /> Reçu PDF (Classique)
            </a>

            <a
              href={`/api/orders/${order.id}/receipt.pdf?duplicate=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full text-center block text-xs"
            >
              <Copy className="w-3.5 h-3.5" /> Réimprimer (DUPLICATA)
            </a>

            {/* Download PDF */}
            <a
              href={`/api/orders/${order.id}/receipt.pdf?download=1`}
              className="btn-secondary w-full text-center block"
            >
              <Download className="w-4 h-4" /> Télécharger la facture
            </a>

            {/* WhatsApp — conversation directe client + reçu partageable */}
            <button
              onClick={() => sendWhatsAppDirect("receipt")}
              disabled={shareLoading}
              className="btn-success w-full text-center flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" /> {shareLoading ? "Ouverture WhatsApp..." : "WhatsApp — Envoyer reçu client"}
            </button>

            {order.status === "PRET" && (
              <button
                onClick={() => sendWhatsAppDirect("ready")}
                disabled={shareLoading}
                className="btn-success w-full text-center flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> {shareLoading ? "Ouverture WhatsApp..." : "WhatsApp — Notifier commande prête"}
              </button>
            )}

            {/* Info */}
            {order.promisedAt && (
              <div className={`p-3 rounded-lg text-sm ${isLate ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>
                <p className="font-medium flex items-center gap-1.5">
                  {isLate ? <><AlertTriangle className="w-4 h-4" /> En retard !</> : <><CalendarClock className="w-4 h-4" /> Date promise</>}
                </p>
                <p>
                  {new Date(order.promisedAt).toLocaleString("fr-SN", {
                    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
            )}

            {order.notes && (
              <div className="bg-gray-50 p-3 rounded-xl text-sm">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-gray-600 flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" /> Notes</p>
                  {isAdmin && order.status !== "LIVRE" && !editingNotes && (
                    <button onClick={() => { setEditNotes(order.notes || ""); setEditingNotes(true); }} className="text-primary-500 hover:text-primary-700 text-xs flex items-center gap-1">
                      <Pencil className="w-3 h-3" /> Modifier
                    </button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <textarea className="input-field text-sm w-full" rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} />
                    <div className="flex gap-2">
                      <button className="btn-primary text-xs" onClick={saveNotes} disabled={actionLoading}><Save className="w-3 h-3" /> Sauvegarder</button>
                      <button className="btn-secondary text-xs" onClick={() => setEditingNotes(false)}><X className="w-3 h-3" /> Annuler</button>
                    </div>
                  </div>
                ) : (
                  <p>{order.notes}</p>
                )}
              </div>
            )}

            {/* Add notes if none exist */}
            {!order.notes && isAdmin && order.status !== "LIVRE" && (
              editingNotes ? (
                <div className="bg-gray-50 p-3 rounded-xl text-sm space-y-2">
                  <p className="font-medium text-gray-600 flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" /> Ajouter une note</p>
                  <textarea className="input-field text-sm w-full" rows={3} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes sur la commande..." />
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs" onClick={saveNotes} disabled={actionLoading}><Save className="w-3 h-3" /> Sauvegarder</button>
                    <button className="btn-secondary text-xs" onClick={() => setEditingNotes(false)}><X className="w-3 h-3" /> Annuler</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setEditNotes(""); setEditingNotes(true); }} className="btn-secondary w-full text-xs">
                  <StickyNote className="w-3.5 h-3.5" /> Ajouter une note
                </button>
              )
            )}

            {/* Edit promised date */}
            {isAdmin && order.status !== "LIVRE" && (
              editingDate ? (
                <div className="bg-blue-50 p-3 rounded-xl text-sm space-y-2">
                  <p className="font-medium text-blue-700 flex items-center gap-1.5"><CalendarClock className="w-3.5 h-3.5" /> Date promise</p>
                  <input type="datetime-local" className="input-field text-sm w-full" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
                  <div className="flex gap-2">
                    <button className="btn-primary text-xs" onClick={savePromisedAt} disabled={actionLoading}><Save className="w-3 h-3" /> Sauvegarder</button>
                    <button className="btn-secondary text-xs" onClick={() => setEditingDate(false)}><X className="w-3 h-3" /> Annuler</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setEditDate(order.promisedAt ? new Date(order.promisedAt).toISOString().slice(0, 16) : ""); setEditingDate(true); }} className="btn-secondary w-full text-xs">
                  <CalendarClock className="w-3.5 h-3.5" /> {order.promisedAt ? "Modifier la date promise" : "Définir une date promise"}
                </button>
              )
            )}

            {/* Error message */}
            {editError && <p className="text-red-500 text-xs bg-red-50 p-2 rounded-lg">{editError}</p>}

            {/* Delete order */}
            {isAdmin && order.status !== "LIVRE" && (
              deleteConfirm ? (
                <div className="bg-red-50 p-3 rounded-xl space-y-2">
                  <p className="text-sm font-medium text-red-700">Supprimer la commande {order.code} ?</p>
                  <p className="text-xs text-red-600">Cette action est irréversible.</p>
                  <div className="flex gap-2">
                    <button className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-red-700" onClick={deleteOrder} disabled={actionLoading}>
                      <Trash2 className="w-3 h-3 inline mr-1" /> Confirmer
                    </button>
                    <button className="btn-secondary text-xs" onClick={() => setDeleteConfirm(false)}>Annuler</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setDeleteConfirm(true)} className="w-full text-center block text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-xl py-2 transition-colors">
                  <Trash2 className="w-3.5 h-3.5 inline mr-1" /> Supprimer la commande
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
