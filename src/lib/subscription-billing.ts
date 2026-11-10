import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { SUBSCRIPTION_PLANS, PlanKey } from "@/lib/subscription-plans";
import type { WaveCheckoutSession } from "@/lib/wave";
import type { CinetPayCheckResponse } from "@/lib/cinetpay";

export interface SubscriptionPaymentRow {
  id: string;
  tenantId: string;
  plan: string;
  amount: number;
  transactionId: string;
  status: string;
}

export async function findSubscriptionPayment(
  transactionId: string
): Promise<SubscriptionPaymentRow | null> {
  const rows = (await prisma.$queryRaw`
    SELECT id, "tenantId", plan, amount, "transactionId", status
    FROM "SubscriptionPayment"
    WHERE "transactionId" = ${transactionId}
    LIMIT 1
  `) as SubscriptionPaymentRow[];
  return rows?.[0] ?? null;
}

/** Durée achetée, déduite du montant payé comparé à la grille tarifaire du plan. */
export function subscriptionDaysFor(plan: string, amount: number): number {
  const def = SUBSCRIPTION_PLANS[plan as PlanKey];
  if (
    def &&
    def.yearlyPrice > 0 &&
    def.yearlyPrice !== def.monthlyPrice &&
    Number(amount) === def.yearlyPrice
  ) {
    return 365;
  }
  return 30;
}

export type ActivationResult =
  | { activated: true; expiresAt: Date }
  | {
      activated: false;
      reason: "already-processed" | "not-paid" | "mismatch";
      detail?: string;
    };

async function commitSubscriptionActivation(params: {
  sub: SubscriptionPaymentRow;
  paymentMethod: string;
  operatorId: string | null;
  auditAction: string;
  auditDetails: Record<string, unknown>;
}): Promise<ActivationResult> {
  const { sub, paymentMethod, operatorId, auditAction, auditDetails } = params;
  const days = subscriptionDaysFor(sub.plan, Number(sub.amount));

  const expiresAt = await prisma.$transaction(async (tx) => {
    const claimed = (await tx.$queryRaw`
      UPDATE "SubscriptionPayment"
      SET status = 'SUCCESS',
          "paymentMethod" = ${paymentMethod},
          "operatorId" = ${operatorId},
          "updatedAt" = NOW()
      WHERE "transactionId" = ${sub.transactionId} AND status <> 'SUCCESS'
      RETURNING id
    `) as Array<{ id: string }>;

    if (!claimed?.length) return null;

    const tenants = (await tx.$queryRaw`
      SELECT subscription, "subscriptionExpiresAt"
      FROM "Tenant"
      WHERE id = ${sub.tenantId}
      FOR UPDATE
    `) as Array<{ subscription: string | null; subscriptionExpiresAt: Date | null }>;

    const now = new Date();
    const current = tenants?.[0];
    const base =
      current?.subscription === sub.plan &&
      current.subscriptionExpiresAt &&
      current.subscriptionExpiresAt > now
        ? new Date(current.subscriptionExpiresAt)
        : now;
    const newExpiry = new Date(base);
    newExpiry.setDate(newExpiry.getDate() + days);

    await tx.$queryRaw`
      UPDATE "Tenant"
      SET subscription = ${sub.plan},
          "subscribedAt" = NOW(),
          "subscriptionExpiresAt" = ${newExpiry},
          "updatedAt" = NOW()
      WHERE id = ${sub.tenantId}
    `;

    return newExpiry;
  });

  if (!expiresAt) return { activated: false, reason: "already-processed" };

  await auditLog({
    tenantId: sub.tenantId,
    action: auditAction,
    entity: "Tenant",
    entityId: sub.tenantId,
    details: {
      ...auditDetails,
      plan: sub.plan,
      amount: sub.amount,
      transactionId: sub.transactionId,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { activated: true, expiresAt };
}

/**
 * Active l'abonnement correspondant à une session Wave payée.
 */
export async function activateSubscriptionFromWave(
  sub: SubscriptionPaymentRow,
  session: WaveCheckoutSession,
  source: "webhook" | "return"
): Promise<ActivationResult> {
  if (sub.status === "SUCCESS") return { activated: false, reason: "already-processed" };
  if (session.payment_status !== "succeeded") return { activated: false, reason: "not-paid" };

  if (session.client_reference !== sub.transactionId) {
    return { activated: false, reason: "mismatch", detail: "client_reference" };
  }
  if (session.currency !== "XOF" || Number(session.amount) !== Number(sub.amount)) {
    return {
      activated: false,
      reason: "mismatch",
      detail: `amount ${session.amount} ${session.currency}`,
    };
  }

  return commitSubscriptionActivation({
    sub,
    paymentMethod: "WAVE",
    operatorId: session.transaction_id || session.id,
    auditAction: source === "webhook" ? "SUBSCRIPTION_ACTIVATED_WEBHOOK" : "SUBSCRIPTION_ACTIVATED",
    auditDetails: {
      provider: "WAVE",
      waveSessionId: session.id,
      waveTransactionId: session.transaction_id,
    },
  });
}

/**
 * Active l'abonnement correspondant à une transaction CinetPay vérifiée.
 * Corrige le forfait BASIC annuel (50 000 FCFA = 365j), vérifie le montant payé et prolonge l'échéance en cours.
 */
export async function activateSubscriptionFromCinetPay(
  sub: SubscriptionPaymentRow,
  checkResult: CinetPayCheckResponse,
  source: "webhook" | "return" | "simulated"
): Promise<ActivationResult> {
  if (sub.status === "SUCCESS") return { activated: false, reason: "already-processed" };
  if (!checkResult.success || checkResult.status !== "ACCEPTED") {
    return { activated: false, reason: "not-paid" };
  }

  if (
    checkResult.amount !== undefined &&
    Math.round(Number(checkResult.amount)) < Math.round(Number(sub.amount))
  ) {
    return {
      activated: false,
      reason: "mismatch",
      detail: `amount ${checkResult.amount} < expected ${sub.amount}`,
    };
  }

  if (checkResult.currency && checkResult.currency !== "XOF") {
    return {
      activated: false,
      reason: "mismatch",
      detail: `currency ${checkResult.currency}`,
    };
  }

  const auditAction =
    source === "simulated"
      ? "SUBSCRIPTION_ACTIVATED_SIMULATED"
      : source === "webhook"
      ? "SUBSCRIPTION_ACTIVATED_WEBHOOK"
      : "SUBSCRIPTION_ACTIVATED";

  return commitSubscriptionActivation({
    sub,
    paymentMethod: checkResult.paymentMethod || "CINETPAY",
    operatorId: checkResult.operatorId || null,
    auditAction,
    auditDetails: {
      provider: source === "simulated" ? "SIMULATED" : "CINETPAY",
      paymentMethod: checkResult.paymentMethod,
      operatorId: checkResult.operatorId,
    },
  });
}
