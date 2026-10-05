"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, User, MessageCircle, ChevronRight, ArrowRight } from "lucide-react";
import { triggerHaptic, actionFeedback } from "@/lib/feedback";

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

const NEXT_STATUS_MAP: Record<string, string> = {
  RECU: "TRAITEMENT",
  TRAITEMENT: "PRET",
  PRET: "LIVRE",
};

const NEXT_STATUS_LABELS: Record<string, string> = {
  RECU: "En traitement",
  TRAITEMENT: "Prêt",
  PRET: "Livré",
};

interface SwipeableOrderCardProps {
  order: Order;
  statusLabels: Record<string, string>;
  statusColors: Record<string, string>;
  paymentBadge: (total: number, paid: number) => React.ReactNode;
  onWhatsApp: (e: React.MouseEvent, order: Order) => void;
  onAdvanceStatus: (order: Order) => void;
}

export function SwipeableOrderCard({
  order,
  statusLabels,
  statusColors,
  paymentBadge,
  onWhatsApp,
  onAdvanceStatus,
}: SwipeableOrderCardProps) {
  const router = useRouter();
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalRef = useRef<boolean | null>(null);
  const hasTriggeredHapticRef = useRef(false);

  const nextStatus = NEXT_STATUS_MAP[order.status];
  const isUnpaid = order.paidAmount < order.totalAmount;
  const isReady = order.status === "PRET";

  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalRef.current = null;
    hasTriggeredHapticRef.current = false;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSwiping) return;

    const diffX = e.touches[0].clientX - startXRef.current;
    const diffY = e.touches[0].clientY - startYRef.current;

    // Detect if primary intent is horizontal swipe
    if (isHorizontalRef.current === null) {
      if (Math.abs(diffX) > 8 || Math.abs(diffY) > 8) {
        isHorizontalRef.current = Math.abs(diffX) > Math.abs(diffY);
      }
    }

    if (isHorizontalRef.current) {
      // Swipe right: WhatsApp (max 90px), Swipe left: Advance status (max -90px)
      // If no next status, dampen left swipe
      let bounded = diffX;
      if (bounded < 0 && !nextStatus) {
        bounded = bounded * 0.2;
      }
      bounded = Math.max(-95, Math.min(95, bounded));
      setOffsetX(bounded);

      if (Math.abs(bounded) >= 70 && !hasTriggeredHapticRef.current) {
        triggerHaptic("medium");
        hasTriggeredHapticRef.current = true;
      }
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);

    if (offsetX >= 70) {
      // Swiped right: trigger WhatsApp
      triggerHaptic("success");
      onWhatsApp({ preventDefault: () => {}, stopPropagation: () => {} } as React.MouseEvent, order);
    } else if (offsetX <= -70 && nextStatus) {
      // Swiped left: trigger status progression
      actionFeedback("status");
      onAdvanceStatus(order);
    }

    setOffsetX(0);
    isHorizontalRef.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Background action reveal for Swipe Right (WhatsApp) */}
      <div
        className={`absolute inset-y-0 left-0 w-24 bg-emerald-600 flex items-center justify-start pl-5 text-white font-bold text-xs transition-opacity ${
          offsetX > 15 ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex flex-col items-center gap-1">
          <MessageCircle className="w-5 h-5 animate-bounce" />
          <span className="text-[10px]">WhatsApp</span>
        </div>
      </div>

      {/* Background action reveal for Swipe Left (Advance status) */}
      <div
        className={`absolute inset-y-0 right-0 w-28 bg-primary-600 flex items-center justify-end pr-4 text-white font-bold text-xs transition-opacity ${
          offsetX < -15 ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex flex-col items-center gap-1">
          <ArrowRight className="w-5 h-5 animate-pulse" />
          <span className="text-[10px] text-center leading-tight">
            {nextStatus ? NEXT_STATUS_LABELS[order.status] : "Détails"}
          </span>
        </div>
      </div>

      {/* Card Content with gesture offset */}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: isSwiping ? "none" : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="card hover:shadow-lg hover:border-primary-100 dark:hover:border-slate-700 transition-all duration-200 flex flex-col sm:flex-row sm:items-center gap-3 relative bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800"
      >
        <div className="flex items-center gap-3 sm:w-10">
          <div className="w-10 h-10 bg-primary-50 dark:bg-primary-950/60 rounded-xl flex items-center justify-center group-hover:bg-primary-100 dark:group-hover:bg-primary-900/60 transition-colors shrink-0">
            <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/orders/${order.id}`}
              className="font-mono font-bold text-base text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              {order.code}
            </Link>
            <span className={`badge ${statusColors[order.status]}`}>
              {statusLabels[order.status] || order.status}
            </span>
            {paymentBadge(order.totalAmount, order.paidAmount)}
          </div>

          <div className="text-sm text-gray-600 dark:text-slate-300 mt-1 flex items-center gap-1.5 flex-wrap">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                router.push(`/customers/${order.customer.id}`);
              }}
              className="font-bold text-gray-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 hover:underline cursor-pointer inline-flex items-center gap-1"
              title="Consulter toute la traçabilité et l'historique de ce client"
            >
              <User className="w-3.5 h-3.5 text-gray-400 dark:text-slate-500" />
              <span>{order.customer.name}</span>
            </span>
            <span className="text-gray-400 dark:text-slate-600">·</span>
            <span className="text-gray-400 dark:text-slate-400 text-xs font-mono">{order.customer.phone}</span>
          </div>

          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">
            {order.items.map((i) => `${i.name} ×${i.quantity}`).join(", ")}
          </p>
        </div>

        <div className="flex items-center sm:items-end justify-between sm:justify-center sm:flex-col gap-2 shrink-0">
          <div className="text-left sm:text-right">
            <p className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">{formatFCFA(order.totalAmount)}</p>
            {isUnpaid && (
              <p className="text-xs text-red-500 dark:text-red-400 font-medium">
                Reste: {formatFCFA(order.totalAmount - order.paidAmount)}
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
              {new Date(order.createdAt).toLocaleDateString("fr-SN")}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            {/* WhatsApp Button */}
            {(isReady || isUnpaid) && (
              <button
                type="button"
                onClick={(e) => onWhatsApp(e, order)}
                title={isReady ? "Notifier le client que le linge est prêt" : "Relancer sur WhatsApp"}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all border border-emerald-200/50 dark:border-emerald-800/50 shadow-sm active:scale-95"
              >
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="hidden sm:inline">{isReady ? "Notifier prêt" : "WhatsApp"}</span>
              </button>
            )}

            <Link
              href={`/orders/${order.id}`}
              className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
