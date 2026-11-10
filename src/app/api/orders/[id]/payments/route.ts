import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { requireAdmin } from "@/lib/rbac";
import { createPaymentSchema } from "@/lib/validators";
import { auditLog } from "@/lib/audit";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id: orderId } = await params;
    const body = await request.json();
    const data = createPaymentSchema.parse(body);

    let overpaymentErrorMsg: string | null = null;

    const txResult = await prisma.$transaction(async (tx) => {
      // Verrou exclusif `FOR UPDATE` sur la commande : sérialise strictement les paiements concurrents sous PostgreSQL READ COMMITTED
      const lockedOrders = (await tx.$queryRaw`
        SELECT id, "totalAmount", "paidAmount"
        FROM "Order"
        WHERE id = ${orderId} AND "tenantId" = ${session.tenantId} AND "deletedAt" IS NULL
        FOR UPDATE
      `) as Array<{ id: string; totalAmount: number; paidAmount: number }>;

      const currentOrder = lockedOrders?.[0];
      if (!currentOrder) {
        throw new Error("NOT_FOUND");
      }

      // Idempotence pour la file d'attente hors-ligne (`clientRequestId`)
      if (data.clientRequestId) {
        const existingAudit = await tx.auditLog.findFirst({
          where: {
            tenantId: session.tenantId,
            action: "PAYMENT_CREATED",
            details: { contains: data.clientRequestId },
          },
          select: { entityId: true },
        });
        if (existingAudit) {
          const existingPayment = await tx.payment.findUnique({
            where: { id: existingAudit.entityId },
          });
          if (existingPayment) {
            return {
              payment: existingPayment,
              newPaidAmount: Number(currentOrder.paidAmount),
              deduplicated: true,
            };
          }
        }
      }

      const amountDue = Math.max(0, Number(currentOrder.totalAmount) - Number(currentOrder.paidAmount));

      if (data.amount > amountDue) {
        overpaymentErrorMsg = `Montant dépasse le reste à payer (${amountDue} FCFA)`;
        return null;
      }

      const payment = await tx.payment.create({
        data: {
          tenantId: session.tenantId,
          orderId,
          amount: data.amount,
          method: data.method,
          note: data.note || null,
          createdBy: session.userId,
        },
      });

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: { paidAmount: { increment: data.amount } },
        select: { id: true, paidAmount: true },
      });

      if (data.clientRequestId) {
        await tx.auditLog.create({
          data: {
            tenantId: session.tenantId,
            userId: session.userId,
            action: "PAYMENT_CREATED",
            entity: "Payment",
            entityId: payment.id,
            details: JSON.stringify({
              orderId,
              amount: data.amount,
              method: data.method,
              newPaidAmount: updatedOrder.paidAmount,
              clientRequestId: data.clientRequestId,
            }),
          },
        });
      }

      return { payment, newPaidAmount: updatedOrder.paidAmount, deduplicated: false };
    });

    if (overpaymentErrorMsg) {
      return errorResponse(overpaymentErrorMsg, 400);
    }

    if (!txResult) {
      return errorResponse("Commande introuvable", 404);
    }

    if (!txResult.deduplicated && !data.clientRequestId) {
      await auditLog({
        tenantId: session.tenantId,
        userId: session.userId,
        action: "PAYMENT_CREATED",
        entity: "Payment",
        entityId: txResult.payment.id,
        details: {
          orderId,
          amount: data.amount,
          method: data.method,
          newPaidAmount: txResult.newPaidAmount,
        },
      });
    }

    return successResponse(txResult.payment, txResult.deduplicated ? 200 : 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id: orderId } = await params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: session.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    const payments = await prisma.payment.findMany({
      where: { orderId, tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
    });

    const users = await prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    const enriched = payments.map((p) => ({
      ...p,
      agentName: p.createdBy ? userMap.get(p.createdBy) || "Agent" : "Système",
    }));

    return successResponse(enriched);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id: orderId } = await params;
    const { paymentId } = await request.json();

    if (!paymentId || typeof paymentId !== "string") {
      return errorResponse("ID du paiement requis", 400);
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: session.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, orderId, tenantId: session.tenantId },
    });

    if (!payment) {
      return errorResponse("Paiement introuvable", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "Order"
        WHERE id = ${orderId} AND "tenantId" = ${session.tenantId} AND "deletedAt" IS NULL
        FOR UPDATE
      `;
      await tx.payment.delete({ where: { id: paymentId } });
      await tx.$executeRaw`
        UPDATE "Order"
        SET "paidAmount" = GREATEST(0, "paidAmount" - ${payment.amount})
        WHERE id = ${orderId} AND "tenantId" = ${session.tenantId}
      `;
    });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "PAYMENT_DELETED",
      entity: "Payment",
      entityId: paymentId,
      details: {
        orderId,
        amount: payment.amount,
        method: payment.method,
        originalPaymentDate: payment.createdAt.toISOString(),
      },
    });

    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
