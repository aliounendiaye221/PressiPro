"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
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
} from "lucide-react";

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

function formatFCFA(n: number) {
  return new Intl.NumberFormat("fr-SN").format(n) + " F";
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
const METHOD_LABELS: Record<string, string> = {
  CASH: "Espèces", OM: "Orange Money", WAVE: "Wave", OTHER: "Autre",
};

function buildWhatsAppUrl(phone: string, message: string) {
  const cleaned = phone.replace(/\s/g, "");
  const num = cleaned.startsWith("+") ? cleaned : `+221${cleaned}`;
  return `https://wa.me/${num.replace("+", "")}?text=${encodeURIComponent(message)}`;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Payment form
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("CASH");

  const fetchOrder = useCallback(async () => {
    const res = await fetch(`/api/orders/${id}`);
    if (res.ok) {
      setOrder(await res.json());
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const advanceStatus = async () => {
    if (!order) return;
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setActionLoading(true);
    await fetch(`/api/orders/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await fetchOrder();
    setActionLoading(false);
  };

  const rollbackStatus = async () => {
    if (!order) return;
    const rollbacks: Record<string, string> = {
      TRAITEMENT: "RECU", PRET: "TRAITEMENT", LIVRE: "PRET",
    };
    const prev = rollbacks[order.status];
    if (!prev) return;
    setActionLoading(true);
    await fetch(`/api/orders/${id}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: prev }),
    });
    await fetchOrder();
    setActionLoading(false);
  };

  const addPayment = async () => {
    if (!order || payAmount <= 0) return;
    setActionLoading(true);
    const res = await fetch(`/api/orders/${id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: payAmount, method: payMethod }),
    });
    if (res.ok) {
      setShowPayment(false);
      setPayAmount(0);
      await fetchOrder();
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

  // WhatsApp messages
  const receiptMsg = `Bonjour ${order.customer.name},\n\nVotre dépôt *${order.code}* au pressing a été enregistré.\nTotal: ${formatFCFA(order.totalAmount)}\nAvance: ${formatFCFA(order.paidAmount)}\nReste: ${formatFCFA(amountDue)}\n\nMerci de votre confiance !`;
  const readyMsg = `Bonjour ${order.customer.name},\n\nVotre commande *${order.code}* est prête ! 🎉\nVeuillez passer la récupérer.\n${amountDue > 0 ? `\nReste à payer: ${formatFCFA(amountDue)}` : ""}\n\nMerci !`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push("/orders")} className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-2xl font-bold font-mono text-gray-900">{order.code}</h1>
        <span className={`badge text-base px-3 py-1 ${STATUS_COLORS[order.status]}`}>
          {STATUS_LABELS[order.status]}
        </span>
        {paymentStatus === "PAYE" && <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 text-sm px-3 py-1">PAYÉ</span>}
        {paymentStatus === "PARTIEL" && <span className="badge bg-amber-50 text-amber-700 ring-1 ring-amber-600/10 text-sm px-3 py-1">PARTIEL</span>}
        {paymentStatus === "IMPAYE" && <span className="badge bg-red-50 text-red-700 ring-1 ring-red-600/10 text-sm px-3 py-1">IMPAYÉ</span>}
        {isLate && <span className="badge bg-red-500 text-white text-sm px-3 py-1 shadow-sm shadow-red-500/30">EN RETARD</span>}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Left column: details */}
        <div className="lg:col-span-2 space-y-4">
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
            <table className="w-full text-sm">
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
                  <div key={p.id} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                    <div>
                      <span className="font-medium">{formatFCFA(p.amount)}</span>
                      <span className="text-gray-500 ml-2">{METHOD_LABELS[p.method]}</span>
                    </div>
                    <span className="text-gray-400">
                      {new Date(p.createdAt).toLocaleString("fr-SN", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
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
          <div className="card space-y-3 sticky top-4">
            <h2 className="font-semibold">Actions</h2>

            {/* Advance status */}
            {NEXT_STATUS[order.status] && (
              <button
                onClick={advanceStatus}
                disabled={actionLoading}
                className="btn-primary w-full btn-lg"
              >
                Passer à : {STATUS_LABELS[NEXT_STATUS[order.status]]}
              </button>
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
            <a
              href={`/api/orders/${order.id}/receipt.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full text-center block"
            >
              <Printer className="w-4 h-4" /> Imprimer reçu
            </a>

            <a
              href={`/api/orders/${order.id}/receipt.pdf?duplicate=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary w-full text-center block text-xs"
            >
              <Copy className="w-3.5 h-3.5" /> Réimprimer (DUPLICATA)
            </a>

            {/* WhatsApp */}
            <a
              href={buildWhatsAppUrl(order.customer.phone, receiptMsg)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-success w-full text-center block"
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp — Envoyer reçu
            </a>

            {order.status === "PRET" && (
              <a
                href={buildWhatsAppUrl(order.customer.phone, readyMsg)}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-success w-full text-center block"
              >
                <MessageCircle className="w-4 h-4" /> WhatsApp — Commande prête
              </a>
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
                <p className="font-medium text-gray-600 flex items-center gap-1.5"><StickyNote className="w-3.5 h-3.5" /> Notes</p>
                <p>{order.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
