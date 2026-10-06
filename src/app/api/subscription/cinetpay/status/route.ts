import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { checkCinetPayTransaction } from "@/lib/cinetpay";
import { auditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("tx");

    if (!transactionId) {
      return errorResponse("Identifiant de transaction manquant", 400);
    }

    // 1. Vérifier si l'enregistrement SubscriptionPayment existe
    const payments = (await prisma.$queryRaw`
      SELECT id, "tenantId", plan, amount, status, "createdAt"
      FROM "SubscriptionPayment"
      WHERE "transactionId" = ${transactionId}
      LIMIT 1
    `) as Array<{
      id: string;
      tenantId: string;
      plan: string;
      amount: number;
      status: string;
      createdAt: Date;
    }>;

    const subPayment = payments?.[0];

    if (!subPayment || subPayment.tenantId !== session.tenantId) {
      return errorResponse("Paiement d'abonnement introuvable pour ce compte", 404);
    }

    // Si déjà validé
    if (subPayment.status === "SUCCESS") {
      return successResponse({
        status: "SUCCESS",
        plan: subPayment.plan,
        alreadyProcessed: true,
      });
    }

    // 2. Vérification auprès de l'API CinetPay
    const checkResult = await checkCinetPayTransaction(transactionId); // plateforme

    if (!checkResult.success || checkResult.status !== "ACCEPTED") {
      return successResponse({
        status: checkResult.status || "PENDING",
        message: checkResult.error || "Paiement en cours de validation",
      });
    }

    // 3. Calcul de la nouvelle date d'expiration (+ 30 jours par défaut ou + 365 jours)
    const isYearly = subPayment.amount >= 100000;
    const daysToAdd = isYearly ? 365 : 30;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + daysToAdd);

    // Mettre à jour SubscriptionPayment et Tenant
    await prisma.$queryRaw`
      UPDATE "SubscriptionPayment"
      SET status = 'SUCCESS',
          "operatorId" = ${checkResult.operatorId || null},
          "paymentMethod" = ${checkResult.paymentMethod || null},
          "updatedAt" = NOW()
      WHERE "transactionId" = ${transactionId}
    `;

    await prisma.$queryRaw`
      UPDATE "Tenant"
      SET subscription = ${subPayment.plan},
          "subscribedAt" = NOW(),
          "subscriptionExpiresAt" = ${expiresAt},
          "updatedAt" = NOW()
      WHERE id = ${session.tenantId}
    `;

    await auditLog({
      tenantId: session.tenantId,
      action: "SUBSCRIPTION_ACTIVATED",
      entity: "Tenant",
      entityId: session.tenantId,
      details: {
        plan: subPayment.plan,
        amount: subPayment.amount,
        transactionId,
        paymentMethod: checkResult.paymentMethod,
        expiresAt: expiresAt.toISOString(),
      },
    });

    return successResponse({
      status: "SUCCESS",
      plan: subPayment.plan,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
