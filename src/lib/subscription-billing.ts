import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { SUBSCRIPTION_PLANS, PlanKey } from "@/lib/subscription-plans";
import type { WaveCheckoutSession } from "@/lib/wave";

export interface SubscriptionPaymentRow {
  id: string;
  tenantId: string;
  plan: string;
  amount: number;
  transactionId: string;
  status: string;
}

export async function findSubscriptionPayment(transactionId: string): Promise<SubscriptionPaymentRow | null> {
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
  if (def && def.yearlyPrice > 0 && def.yearlyPrice !== def.monthlyPrice && amount === def.yearlyPrice) {
    return 365;
  }
  return 30;
}

export type ActivationResult =
  | { activated: true; expiresAt: Date }
  | { activated: false; reason: "already-processed" | "not-paid" | "mismatch"; detail?: string };

/**
 * Active l'abonnement correspondant à une session Wave payée.
 * Idempotent : un même paiement ne prolonge jamais l'abonnement deux fois
 * (webhook + page de retour peuvent arriver en même temps).
 */
export async function activateSubscriptionFromWave(
  sub: SubscriptionPaymentRow,
  session: WaveCheckoutSession,
  source: "webhook" | "return"
): Promise<ActivationResult> {
  if (sub.status === "SUCCESS") return { activated: false, reason: "already-processed" };
  if (session.payment_status !== "succeeded") return { activated: false, reason: "not-paid" };

  // Contrôles anti-fraude : la session Wave doit correspondre exactement au paiement attendu
  if (session.client_reference !== sub.transactionId) {
    return { activated: false, reason: "mismatch", detail: "client_reference" };
  }
  if (session.currency !== "XOF" || Number(session.amount) !== Number(sub.amount)) {
    return { activated: false, reason: "mismatch", detail: `amount ${session.amount} ${session.currency}` };
  }

  const days = subscriptionDaysFor(sub.plan, Number(sub.amount));

  const expiresAt = await prisma.$transaction(async (tx) => {
    // Verrou logique : seule la première requête passe de PENDING à SUCCESS
    const claimed = (await tx.$queryRaw`
      UPDATE "SubscriptionPayment"
      SET status = 'SUCCESS',
          "paymentMethod" = 'WAVE',
          "operatorId" = ${session.transaction_id || session.id},
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

    // Renouvellement anticipé du même plan : on prolonge à partir de l'échéance en cours
    const now = new Date();
    const current = tenants?.[0];
    const base =
      current?.subscription === sub.plan && current.subscriptionExpiresAt && current.subscriptionExpiresAt > now
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
    action: source === "webhook" ? "SUBSCRIPTION_ACTIVATED_WEBHOOK" : "SUBSCRIPTION_ACTIVATED",
    entity: "Tenant",
    entityId: sub.tenantId,
    details: {
      provider: "WAVE",
      plan: sub.plan,
      amount: sub.amount,
      transactionId: sub.transactionId,
      waveSessionId: session.id,
      waveTransactionId: session.transaction_id,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return { activated: true, expiresAt };
}
