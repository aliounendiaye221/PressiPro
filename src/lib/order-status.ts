import { OrderStatus } from "@prisma/client";

/**
 * Valid status transitions:
 * RECU -> TRAITEMENT
 * TRAITEMENT -> PRET
 * PRET -> LIVRE
 *
 * Admin-only rollbacks:
 * TRAITEMENT -> RECU
 * PRET -> TRAITEMENT
 * LIVRE -> PRET
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECU: [OrderStatus.TRAITEMENT],
  TRAITEMENT: [OrderStatus.PRET, OrderStatus.RECU], // RECU = rollback
  PRET: [OrderStatus.LIVRE, OrderStatus.TRAITEMENT], // TRAITEMENT = rollback
  LIVRE: [OrderStatus.PRET], // PRET = rollback
};

const ROLLBACK_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  RECU: [],
  TRAITEMENT: [OrderStatus.RECU],
  PRET: [OrderStatus.TRAITEMENT],
  LIVRE: [OrderStatus.PRET],
};

export function canTransition(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isRollback(
  from: OrderStatus,
  to: OrderStatus
): boolean {
  return ROLLBACK_TRANSITIONS[from]?.includes(to) ?? false;
}

export function getNextStatuses(current: OrderStatus): OrderStatus[] {
  return TRANSITIONS[current] ?? [];
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  RECU: "Reçu",
  TRAITEMENT: "En traitement",
  PRET: "Prêt",
  LIVRE: "Livré",
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  RECU: "bg-blue-100 text-blue-800",
  TRAITEMENT: "bg-yellow-100 text-yellow-800",
  PRET: "bg-green-100 text-green-800",
  LIVRE: "bg-gray-100 text-gray-800",
};
