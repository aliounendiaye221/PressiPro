"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Inbox,
  Clock,
  CheckCircle2,
  Truck,
  MessageCircle,
  ArrowRight,
  Package,
  User,
  GripVertical,
} from "lucide-react";
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

const KANBAN_COLUMNS = [
  {
    key: "RECU",
    label: "Reçu",
    icon: Inbox,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-900/60",
    badge: "badge-glow-blue",
    nextStatus: "TRAITEMENT",
    nextLabel: "Lancer traitement",
  },
  {
    key: "TRAITEMENT",
    label: "En traitement",
    icon: Clock,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-900/60",
    badge: "badge-glow-amber",
    nextStatus: "PRET",
    nextLabel: "Marquer prêt",
  },
  {
    key: "PRET",
    label: "Prêt",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-900/60",
    badge: "badge-glow-emerald",
    nextStatus: "LIVRE",
    nextLabel: "Marquer livré",
  },
  {
    key: "LIVRE",
    label: "Livré",
    icon: Truck,
    color: "text-gray-600 dark:text-slate-400",
    bg: "bg-gray-50 dark:bg-slate-800/60",
    border: "border-gray-200 dark:border-slate-800",
    badge: "badge-glow-gray",
    nextStatus: null,
    nextLabel: null,
  },
];

interface OrdersKanbanProps {
  orders: Order[];
  onStatusChange: (orderId: string, newStatus: string) => Promise<void> | void;
  onWhatsApp: (e: React.MouseEvent, order: Order) => void;
  paymentBadge: (total: number, paid: number) => React.ReactNode;
}

export function OrdersKanban({
  orders,
  onStatusChange,
  onWhatsApp,
  paymentBadge,
}: OrdersKanbanProps) {
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, orderId: string) => {
    e.dataTransfer.setData("text/plain", orderId);
    setDraggedOrderId(orderId);
    triggerHaptic("light");
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    if (dragOverColumn !== colKey) {
      setDragOverColumn(colKey);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const orderId = e.dataTransfer.getData("text/plain") || draggedOrderId;
    setDraggedOrderId(null);

    if (!orderId) return;

    const currentOrder = orders.find((o) => o.id === orderId);
    if (!currentOrder || currentOrder.status === targetStatus) return;

    actionFeedback("status");
    await onStatusChange(orderId, targetStatus);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {KANBAN_COLUMNS.map((col) => {
        const Icon = col.icon;
        const columnOrders = orders.filter((o) => o.status === col.key);
        const columnTotal = columnOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        const isTarget = dragOverColumn === col.key;

        return (
          <div
            key={col.key}
            onDragOver={(e) => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, col.key)}
            className={`rounded-2xl border transition-all duration-200 flex flex-col min-h-[520px] ${
              isTarget
                ? "border-primary-500 bg-primary-50/20 dark:bg-primary-950/20 ring-2 ring-primary-500/20"
                : "border-gray-200/80 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50"
            }`}
          >
            {/* Column Header */}
            <div className="p-3.5 border-b border-gray-200/70 dark:border-slate-800/80 bg-white dark:bg-slate-900 rounded-t-2xl flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-lg ${col.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${col.color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-gray-900 dark:text-white leading-tight">
                    {col.label}
                  </h3>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">
                    {formatFCFA(columnTotal)}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${col.bg} ${col.color}`}>
                {columnOrders.length}
              </span>
            </div>

            {/* Droppable orders list */}
            <div className="p-3 space-y-2.5 flex-1 overflow-y-auto max-h-[75vh]">
              {columnOrders.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-gray-200 dark:border-slate-800 rounded-xl text-gray-400 dark:text-slate-600 text-xs">
                  <Package className="w-6 h-6 mb-1.5 opacity-40" />
                  <span>Glisser une commande ici</span>
                </div>
              ) : (
                columnOrders.map((order) => {
                  const isUnpaid = order.paidAmount < order.totalAmount;
                  const isReady = order.status === "PRET";
                  const isDragging = draggedOrderId === order.id;

                  return (
                    <div
                      key={order.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, order.id)}
                      className={`card p-3.5 bg-white dark:bg-slate-900 border border-gray-200/70 dark:border-slate-800 rounded-xl shadow-xs hover:shadow-md transition-all cursor-grab active:cursor-grabbing ${
                        isDragging ? "opacity-50 scale-95" : ""
                      }`}
                    >
                      {/* Top row: Code + Drag handle + Pay badge */}
                      <div className="flex items-center justify-between gap-1.5 mb-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 shrink-0" />
                          <Link
                            href={`/orders/${order.id}`}
                            className="font-mono font-bold text-xs text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 truncate"
                          >
                            {order.code}
                          </Link>
                        </div>
                        {paymentBadge(order.totalAmount, order.paidAmount)}
                      </div>

                      {/* Customer info */}
                      <div className="mb-2">
                        <Link
                          href={`/customers/${order.customer.id}`}
                          className="font-semibold text-xs text-gray-800 dark:text-slate-200 hover:text-primary-600 dark:hover:text-primary-400 truncate flex items-center gap-1"
                        >
                          <User className="w-3 h-3 text-gray-400 shrink-0" />
                          <span className="truncate">{order.customer.name}</span>
                        </Link>
                        <p className="text-[11px] text-gray-400 dark:text-slate-500 font-mono mt-0.5">
                          {order.customer.phone}
                        </p>
                      </div>

                      {/* Items brief */}
                      <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate mb-2.5 bg-gray-50 dark:bg-slate-800/60 p-1.5 rounded-lg">
                        {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
                      </p>

                      {/* Footer: Amount & Action button */}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800/80">
                        <div>
                          <p className="font-bold text-xs text-gray-900 dark:text-white">
                            {formatFCFA(order.totalAmount)}
                          </p>
                          {isUnpaid && (
                            <p className="text-[10px] text-red-500 dark:text-red-400 font-medium">
                              Reste: {formatFCFA(order.totalAmount - order.paidAmount)}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {/* WhatsApp shortcut */}
                          {(isReady || isUnpaid) && (
                            <button
                              type="button"
                              onClick={(e) => onWhatsApp(e, order)}
                              title="Contacter sur WhatsApp"
                              className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Quick advance status */}
                          {col.nextStatus && (
                            <button
                              type="button"
                              onClick={() => {
                                actionFeedback("status");
                                onStatusChange(order.id, col.nextStatus!);
                              }}
                              title={col.nextLabel || "Avancer"}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-primary-50 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/60 rounded-lg text-[10px] font-bold transition-all active:scale-95"
                            >
                              <span>Avancer</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
