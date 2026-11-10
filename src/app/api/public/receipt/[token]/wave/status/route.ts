import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyReceiptShareToken } from "@/lib/receipt-share";
import { searchWaveCheckoutSessions, isWaveConfigured } from "@/lib/wave";
import { verifyOrderTransactionBinding } from "@/lib/cinetpay";
import { recordOnlineOrderPayment } from "@/lib/order-payment-reconcile";
import { errorResponse, successResponse, handleApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const rate = await checkRateLimit(`public:wave:status:${clientIp}`, 30, 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Trop de requêtes. Veuillez patienter un instant." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const { token } = await params;
    const payload = await verifyReceiptShareToken(token);

    if (!payload) {
      return errorResponse("Lien de reçu invalide ou expiré", 401);
    }

    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("tx")?.trim();

    if (!transactionId) {
      return errorResponse("Identifiant de transaction manquant", 400);
    }

    if (!transactionId.startsWith("PPO-")) {
      return errorResponse("Identifiant de transaction invalide pour cette commande", 400);
    }

    const order = await prisma.order.findFirst({
      where: {
        id: payload.orderId,
        tenantId: payload.tenantId,
        deletedAt: null,
        tenant: { active: true },
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

    if (!verifyOrderTransactionBinding(transactionId, order, { allowLegacyUnbound: true })) {
      return errorResponse("Cette transaction ne correspond pas à ce reçu", 403);
    }

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

    if (isWaveConfigured()) {
      try {
        const sessions = await searchWaveCheckoutSessions(transactionId);
        const successfulSession = sessions.find(
          (s) =>
            s.payment_status === "succeeded" &&
            s.client_reference === transactionId &&
            (!s.currency || s.currency === "XOF")
        );

        if (successfulSession) {
          const amountPaid = Math.round(Number(successfulSession.amount) || 0);
          const waveTxId = successfulSession.transaction_id || successfulSession.id;

          const outcome = await recordOnlineOrderPayment({
            orderId: order.id,
            tenantId: order.tenantId,
            transactionId,
            amountPaid,
            method: "WAVE",
            note: `Paiement en ligne Wave (Réf Wave: ${waveTxId}) - Réf: ${transactionId}`,
            auditProvider: "WAVE_VERIFICATION",
            auditExtra: {
              waveTxId,
              waveSessionId: successfulSession.id,
            },
          });

          if (outcome.status === "CONFLICT_OTHER_ORDER") {
            return errorResponse("Cette transaction est déjà associée à une autre commande", 409);
          }

          return successResponse({
            status: "ACCEPTED",
            recorded: true,
            amount: outcome.status === "RECORDED" ? outcome.amountRecorded : amountPaid,
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
