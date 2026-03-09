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

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: session.tenantId },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    const amountDue = order.totalAmount - order.paidAmount;
    if (data.amount > amountDue) {
      return errorResponse(
        `Montant dépasse le reste à payer (${amountDue} FCFA)`,
        400
      );
    }

    const result = await prisma.$transaction(async (tx) => {
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
      });

      return { payment, order: updatedOrder };
    });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "PAYMENT_CREATED",
      entity: "Payment",
      entityId: result.payment.id,
      details: {
        orderId,
        amount: data.amount,
        method: data.method,
        newPaidAmount: result.order.paidAmount,
      },
    });

    return successResponse(result.payment, 201);
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
      where: { id: orderId, tenantId: session.tenantId },
      select: { id: true },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    const payments = await prisma.payment.findMany({
      where: { orderId, tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(payments);
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

    if (!paymentId) {
      return errorResponse("ID du paiement requis", 400);
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, orderId, tenantId: session.tenantId },
    });

    if (!payment) {
      return errorResponse("Paiement introuvable", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } });
      await tx.order.update({
        where: { id: orderId },
        data: { paidAmount: { decrement: payment.amount } },
      });
    });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "PAYMENT_DELETED",
      entity: "Payment",
      entityId: paymentId,
      details: { orderId, amount: payment.amount, method: payment.method },
    });

    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
