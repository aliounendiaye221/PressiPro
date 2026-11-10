import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { verifyOrderTransactionBinding } from "@/lib/cinetpay";
import type { PaymentMethod } from "@prisma/client";

export interface ResolvedOrderTarget {
  id: string;
  code: string;
  tenantId: string;
  totalAmount: number;
  paidAmount: number;
}

/**
 * Valide strictement une URL marchande Wave configurée par un pressing (empêche tout Open Redirect).
 */
export function normalizeSafeWaveMerchantUrl(raw: string | null | undefined): string | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;

  const looksLikeUrl =
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("pay.wave.com/");
  if (!looksLikeUrl) return null;

  try {
    const candidate = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (host === "pay.wave.com" || host === "wave.com" || host.endsWith(".wave.com")) {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Reconstruit les codes de commande candidats à partir du segment alphanumérique (`P00123` -> `["P00123", "P-00123"]`).
 */
export function candidateOrderCodesFromClean(cleanCode: string): string[] {
  const codes = new Set<string>();
  if (!cleanCode) return [];
  codes.add(cleanCode);
  const hyphenated = cleanCode.replace(/^([A-Za-z]+)(\d+)$/, "$1-$2");
  if (hyphenated !== cleanCode) {
    codes.add(hyphenated);
  }
  return Array.from(codes);
}

/**
 * Résout de manière déterministe et isolée par tenant la commande associée à une transaction `PPO-...`.
 */
export async function resolveOrderForTransaction(
  transactionId: string,
  metadata?: { orderId?: string; tenantId?: string }
): Promise<ResolvedOrderTarget | null> {
  if (!transactionId || !transactionId.startsWith("PPO-")) {
    return null;
  }

  // 1. Recherche directe par orderId CUID si fourni dans metadata
  if (metadata?.orderId) {
    const direct = await prisma.order.findFirst({
      where: {
        id: metadata.orderId,
        ...(metadata.tenantId ? { tenantId: metadata.tenantId } : {}),
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        tenantId: true,
        totalAmount: true,
        paidAmount: true,
      },
    });
    if (direct && verifyOrderTransactionBinding(transactionId, direct, { allowLegacyUnbound: true })) {
      return direct;
    }
    return null;
  }

  // 2. Résolution via code + tag HMAC numérique 6 chiffres (supporte P-00123 et multi-tenant)
  const parts = transactionId.split("-");
  if (parts.length !== 3) return null;
  const cleanCode = parts[1];
  const candidateCodes = candidateOrderCodesFromClean(cleanCode);
  if (candidateCodes.length === 0) return null;

  const candidates = await prisma.order.findMany({
    where: {
      code: { in: candidateCodes },
      ...(metadata?.tenantId ? { tenantId: metadata.tenantId } : {}),
      deletedAt: null,
    },
    select: {
      id: true,
      code: true,
      tenantId: true,
      totalAmount: true,
      paidAmount: true,
    },
    take: 50,
  });

  // Priorité stricte aux transactions liées par HMAC (tenantId + orderId)
  const boundMatches = candidates.filter((c) =>
    verifyOrderTransactionBinding(transactionId, c, { allowLegacyUnbound: false })
  );
  if (boundMatches.length === 1) {
    return boundMatches[0];
  }

  // Tolérance transitoire pour une transaction legacy en vol uniquement s'il n'y a aucune ambiguïté inter-tenant
  if (boundMatches.length === 0 && candidates.length === 1) {
    if (verifyOrderTransactionBinding(transactionId, candidates[0], { allowLegacyUnbound: true })) {
      return candidates[0];
    }
  }

  return null;
}

export type RecordOnlinePaymentResult =
  | { status: "RECORDED"; amountRecorded: number }
  | { status: "ALREADY_RECORDED" }
  | { status: "CONFLICT_OTHER_ORDER" }
  | { status: "NO_BALANCE_DUE" };

/**
 * Enregistre un paiement en ligne de manière strictement atomique et idempotente :
 * - Verrou consultatif PostgreSQL sur `transactionId` (sérialise webhook + retour navigateur + tentatives de rejeu)
 * - Vérification globale sur toute la table `Payment` qu'aucune autre commande n'utilise ce `transactionId`
 * - Verrou exclusif `SELECT ... FOR UPDATE` sur la ligne `Order` pour empêcher tout surpaiement concurrent
 */
export async function recordOnlineOrderPayment(params: {
  orderId: string;
  tenantId: string;
  transactionId: string;
  amountPaid: number;
  method: PaymentMethod;
  note: string;
  auditProvider: string;
  auditExtra?: Record<string, unknown>;
}): Promise<RecordOnlinePaymentResult> {
  const { orderId, tenantId, transactionId, amountPaid, method, note, auditProvider, auditExtra } =
    params;

  const txOutcome = await prisma.$transaction(async (tx) => {
    // 1. Sérialisation globale sur l'identifiant de transaction externe
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`online-pay:${transactionId}`}))`;

    // 2. Vérification globale d'unicité sur toute la table Payment (tous tenants et commandes confondus)
    const existingPayment = await tx.payment.findFirst({
      where: {
        OR: [
          { note: { contains: `Ref: ${transactionId}` } },
          { note: { contains: `Réf: ${transactionId}` } },
        ],
      },
      select: { id: true, orderId: true },
    });

    if (existingPayment) {
      if (existingPayment.orderId === orderId) {
        return { status: "ALREADY_RECORDED" as const };
      }
      return { status: "CONFLICT_OTHER_ORDER" as const };
    }

    // 3. Verrouillage exclusif de la commande (`FOR UPDATE`) pour garantir `paidAmount <= totalAmount`
    const lockedOrders = (await tx.$queryRaw`
      SELECT id, "totalAmount", "paidAmount"
      FROM "Order"
      WHERE id = ${orderId} AND "tenantId" = ${tenantId} AND "deletedAt" IS NULL
      FOR UPDATE
    `) as Array<{ id: string; totalAmount: number; paidAmount: number }>;

    const currentOrder = lockedOrders?.[0];
    if (!currentOrder) {
      return { status: "NO_BALANCE_DUE" as const };
    }

    const remaining = Math.max(0, Number(currentOrder.totalAmount) - Number(currentOrder.paidAmount));
    const normalizedPaid = Math.round(Number(amountPaid) || 0);
    const amountToRecord = normalizedPaid > 0 ? Math.min(normalizedPaid, remaining) : 0;

    if (amountToRecord <= 0) {
      return { status: "NO_BALANCE_DUE" as const };
    }

    await tx.payment.create({
      data: {
        tenantId,
        orderId,
        amount: amountToRecord,
        method,
        note,
      },
    });

    await tx.order.update({
      where: { id: orderId },
      data: {
        paidAmount: { increment: amountToRecord },
      },
    });

    return { status: "RECORDED" as const, amountRecorded: amountToRecord };
  });

  if (txOutcome.status === "RECORDED") {
    await auditLog({
      tenantId,
      action: "PAYMENT_CREATED",
      entity: "Payment",
      entityId: orderId,
      details: {
        provider: auditProvider,
        transactionId,
        amount: txOutcome.amountRecorded,
        paymentMethod: method,
        ...(auditExtra || {}),
      },
    });
  }

  return txOutcome;
}
