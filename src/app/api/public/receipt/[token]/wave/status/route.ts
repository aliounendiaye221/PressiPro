import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { verifyReceiptShareToken } from "@/lib/receipt-share";
import { searchWaveCheckoutSessions, isWaveConfigured } from "@/lib/wave";
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

    // 1. Déjà enregistré ?
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

    // 2. Vérification auprès de l'API Wave Checkout
    if (isWaveConfigured()) {
      try {
        const sessions = await searchWaveCheckoutSessions(transactionId);
        const successfulSession = sessions.find((s) => s.payment_status === "succeeded");

        if (successfulSession) {
          const amountPaid = Math.round(Number(successfulSession.amount));
          const waveTxId = successfulSession.transaction_id || successfulSession.id;

          await prisma.$transaction(async (tx) => {
            const currentOrder = await tx.order.findUnique({
              where: { id: order.id },
              select: { id: true, totalAmount: true, paidAmount: true },
            });
            if (!currentOrder) return;

            const remaining = Math.max(0, currentOrder.totalAmount - currentOrder.paidAmount);
            const toRecord = Math.min(amountPaid, remaining);
            if (toRecord <= 0) return;

            await tx.payment.create({
              data: {
                tenantId: order.tenantId,
                orderId: order.id,
                amount: toRecord,
                method: "WAVE",
                note: `Paiement en ligne Wave (Réf Wave: ${waveTxId}) - Réf: ${transactionId}`,
              },
            });

            await tx.order.update({
              where: { id: order.id },
              data: {
                paidAmount: { increment: toRecord },
              },
            });
          });

          await auditLog({
            tenantId: order.tenantId,
            action: "PAYMENT_CREATED",
            entity: "Payment",
            entityId: order.id,
            details: {
              provider: "WAVE_VERIFICATION",
              transactionId,
              waveTxId,
              amount: amountPaid,
              paymentMethod: "WAVE",
            },
          });

          return successResponse({
            status: "ACCEPTED",
            recorded: true,
            amount: amountPaid,
          });
        }
      } catch (err) {
        console.warn("[Wave Status Check Error]", err);
      }
    }

    return successResponse({
      status: "PENDING",
      recorded: false,
      message: "Paiement en cours de validation",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
