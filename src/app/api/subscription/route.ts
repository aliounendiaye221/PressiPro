import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, successResponse } from "@/lib/api-utils";
import { SUBSCRIPTION_PLANS, PlanKey } from "@/lib/subscription-plans";

export async function GET() {
  try {
    const session = await requireAdmin();

    const rows = (await prisma.$queryRaw`
      SELECT id, name, subscription, "subscribedAt", "subscriptionExpiresAt"
      FROM "Tenant"
      WHERE id = ${session.tenantId}
      LIMIT 1
    `) as Array<{
      id: string;
      name: string;
      subscription: string;
      subscribedAt: Date | null;
      subscriptionExpiresAt: Date | null;
    }>;

    const tenant = rows?.[0];

    if (!tenant) {
      return NextResponse.json({ error: "Tenant introuvable" }, { status: 404 });
    }

    const payments = (await prisma.$queryRaw`
      SELECT id, plan, amount, "transactionId", "paymentMethod", status, "createdAt"
      FROM "SubscriptionPayment"
      WHERE "tenantId" = ${session.tenantId}
      ORDER BY "createdAt" DESC
      LIMIT 10
    `) as Array<{
      id: string;
      plan: string;
      amount: number;
      transactionId: string;
      paymentMethod: string | null;
      status: string;
      createdAt: Date;
    }>;

    const currentPlanKey = (tenant.subscription || "FREE") as PlanKey;
    const currentPlan = SUBSCRIPTION_PLANS[currentPlanKey] || SUBSCRIPTION_PLANS.FREE;

    return successResponse({
      currentPlanKey,
      currentPlan,
      subscribedAt: tenant.subscribedAt,
      subscriptionExpiresAt: tenant.subscriptionExpiresAt,
      payments: payments || [],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
