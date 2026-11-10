import { prisma } from "./db";
import { SUBSCRIPTION_PLANS, type PlanKey } from "./subscription-plans";

export interface PlanQuotaLimits {
  maxOrdersTotal: number | null;
  maxOrdersPerMonth: number | null;
  maxUsers: number | null;
  allowDirectOnlinePayments: boolean;
  allowCustomBranding: boolean;
}

export const PLAN_QUOTA_LIMITS: Record<PlanKey, PlanQuotaLimits> = {
  FREE: {
    maxOrdersTotal: 50,
    maxOrdersPerMonth: null,
    maxUsers: 1,
    allowDirectOnlinePayments: true,
    allowCustomBranding: false,
  },
  BASIC: {
    maxOrdersTotal: null,
    maxOrdersPerMonth: 300,
    maxUsers: 3,
    allowDirectOnlinePayments: true,
    allowCustomBranding: false,
  },
  PRO: {
    maxOrdersTotal: null,
    maxOrdersPerMonth: null,
    maxUsers: null,
    allowDirectOnlinePayments: true,
    allowCustomBranding: true,
  },
  ENTERPRISE: {
    maxOrdersTotal: null,
    maxOrdersPerMonth: null,
    maxUsers: null,
    allowDirectOnlinePayments: true,
    allowCustomBranding: true,
  },
};

export interface TenantSubscriptionState {
  configuredPlan: PlanKey;
  effectivePlan: PlanKey;
  isExpired: boolean;
  subscriptionExpiresAt: Date | null;
  limits: PlanQuotaLimits;
  usage: {
    totalOrders: number;
    monthOrders: number;
    activeUsers: number;
  };
  enforced: boolean;
}

/**
 * Pour ne jamais bloquer brutalement les pressings historiques déjà en production,
 * l'application stricte (`403`) des quotas est activable via `ENFORCE_SAAS_QUOTAS="true"`.
 * Par défaut, l'état réel est calculé et remonté à l'interface `/subscription`.
 */
export function isSaasQuotaEnforced(): boolean {
  return process.env.ENFORCE_SAAS_QUOTAS === "true";
}

export async function evaluateTenantSubscriptionState(
  tenantId: string
): Promise<TenantSubscriptionState> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [tenantRows, totalOrders, monthOrders, activeUsers] = await Promise.all([
    prisma.$queryRaw<
      Array<{ subscription: string | null; subscriptionExpiresAt: Date | null }>
    >`
      SELECT subscription, "subscriptionExpiresAt"
      FROM "Tenant"
      WHERE id = ${tenantId}
      LIMIT 1
    `,
    prisma.order.count({ where: { tenantId, deletedAt: null } }),
    prisma.order.count({
      where: { tenantId, deletedAt: null, createdAt: { gte: startOfMonth } },
    }),
    prisma.user.count({ where: { tenantId, active: true } }),
  ]);

  const tenant = tenantRows?.[0];
  const rawPlan = (tenant?.subscription || "FREE") as PlanKey;
  const configuredPlan: PlanKey = SUBSCRIPTION_PLANS[rawPlan] ? rawPlan : "FREE";
  const expiresAt = tenant?.subscriptionExpiresAt
    ? new Date(tenant.subscriptionExpiresAt)
    : null;

  const isExpired =
    configuredPlan !== "FREE" &&
    expiresAt !== null &&
    expiresAt.getTime() < now.getTime();

  const effectivePlan: PlanKey = isExpired ? "FREE" : configuredPlan;
  const limits = PLAN_QUOTA_LIMITS[effectivePlan];

  return {
    configuredPlan,
    effectivePlan,
    isExpired,
    subscriptionExpiresAt: expiresAt,
    limits,
    usage: {
      totalOrders,
      monthOrders,
      activeUsers,
    },
    enforced: isSaasQuotaEnforced(),
  };
}

export async function checkOrderCreationQuota(
  tenantId: string
): Promise<{ allowed: boolean; message?: string; softWarning?: string }> {
  const state = await evaluateTenantSubscriptionState(tenantId);
  const { limits, usage, effectivePlan, isExpired, enforced } = state;

  if (limits.maxOrdersTotal !== null && usage.totalOrders >= limits.maxOrdersTotal) {
    const msg = isExpired
      ? `Votre abonnement a expiré et la limite de ${limits.maxOrdersTotal} commandes du plan Gratuit est atteinte. Renouvelez votre abonnement dans l'onglet Abonnement.`
      : `Limite de ${limits.maxOrdersTotal} commandes atteinte pour le plan ${SUBSCRIPTION_PLANS[effectivePlan].name}. Passez au Plan Basic ou Pro pour continuer.`;
    return enforced ? { allowed: false, message: msg } : { allowed: true, softWarning: msg };
  }

  if (limits.maxOrdersPerMonth !== null && usage.monthOrders >= limits.maxOrdersPerMonth) {
    const msg = `Limite mensuelle de ${limits.maxOrdersPerMonth} commandes atteinte pour le ${SUBSCRIPTION_PLANS[effectivePlan].name}. Passez au Plan Pro pour des commandes illimitées.`;
    return enforced ? { allowed: false, message: msg } : { allowed: true, softWarning: msg };
  }

  return { allowed: true };
}

export async function checkUserCreationQuota(
  tenantId: string
): Promise<{ allowed: boolean; message?: string; softWarning?: string }> {
  const state = await evaluateTenantSubscriptionState(tenantId);
  const { limits, usage, effectivePlan, enforced } = state;

  if (limits.maxUsers !== null && usage.activeUsers >= limits.maxUsers) {
    const msg = `Limite de ${limits.maxUsers} compte(s) actif(s) atteinte pour le ${SUBSCRIPTION_PLANS[effectivePlan].name}. Mettez à niveau votre abonnement pour ajouter plus d'agents.`;
    return enforced ? { allowed: false, message: msg } : { allowed: true, softWarning: msg };
  }

  return { allowed: true };
}
