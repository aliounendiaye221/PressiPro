import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyReceiptShareToken } from "@/lib/receipt-share";
import { checkCinetPayTransaction, mapCinetPayMethod } from "@/lib/cinetpay";
import { errorResponse, successResponse, handleApiError } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const payload = await verifyReceiptShareToken(token);

    if (!payload) {
      return errorResponse("Lien de reçu invalide ou expiré", 401);
    }

    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("tx");

    if (!transactionId) {
      return errorResponse("Identifiant de transaction manquant", 400);
    }

    const order = await prisma.order.findFirst({
      where: {
        id: payload.orderId,
        tenantId: payload.tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        code: true,
        tenantId: true,
        totalAmount: true,
        paidAmount: true,
        payments: {
          select: { note: true, amount: true },
        },
      },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    // 1. Vérifier si un paiement pour cette transaction a déjà été enregistré
    const alreadyRecorded = order.payments.some((p: { note?: string | null }) =>
      p.note?.includes(transactionId)
    );

    if (alreadyRecorded) {
      return successResponse({
        status: "ACCEPTED",
        recorded: true,
        paidAmount: order.paidAmount,
        totalAmount: order.totalAmount,
      });
    }

    // 2. Vérifier auprès de CinetPay
    const checkResult = await checkCinetPayTransaction(transactionId, order.tenantId);

    if (!checkResult.success || checkResult.status !== "ACCEPTED") {
      return successResponse({
        status: checkResult.status || "PENDING",
        recorded: false,
        message: checkResult.error || "Paiement en attente de confirmation",
      });
    }

    const paidAmountCinet = checkResult.amount || (order.totalAmount - order.paidAmount);
    const paymentMethod = mapCinetPayMethod(checkResult.paymentMethod);

    // 3. Enregistrer le paiement de manière idempotente dans une transaction Prisma
    await prisma.$transaction(async (tx) => {
      // Re-vérifier l'état dans la transaction
      const currentOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: { id: true, totalAmount: true, paidAmount: true },
      });

      if (!currentOrder) return;

      const remaining = currentOrder.totalAmount - currentOrder.paidAmount;
      const amountToRecord = Math.min(paidAmountCinet, Math.max(0, remaining));

      if (amountToRecord <= 0) return;

      const note = `Paiement en ligne CinetPay (${checkResult.paymentMethod || "Web"}) - Ref: ${transactionId}`;

      await tx.payment.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          amount: amountToRecord,
          method: paymentMethod,
          note,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          paidAmount: { increment: amountToRecord },
        },
      });
    });

    await auditLog({
      tenantId: order.tenantId,
      action: "PAYMENT_CREATED",
      entity: "Payment",
      entityId: order.id,
      details: {
        provider: "CINETPAY",
        transactionId,
        amount: paidAmountCinet,
        paymentMethod,
      },
    });

    return successResponse({
      status: "ACCEPTED",
      recorded: true,
      amount: paidAmountCinet,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
