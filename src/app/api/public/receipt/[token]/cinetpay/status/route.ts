import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyReceiptShareToken } from "@/lib/receipt-share";
import {
  checkCinetPayTransaction,
  mapCinetPayMethod,
  verifyOrderTransactionBinding,
} from "@/lib/cinetpay";
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
    const rate = await checkRateLimit(`public:cinetpay:status:${clientIp}`, 30, 60 * 1000);
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

    // Interdire strictement l'utilisation d'un identifiant d'abonnement SUB-... sur une commande
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

    // Vérifier que ce transactionId appartient bien à cette commande (et ce tenant)
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

    const checkResult = await checkCinetPayTransaction(transactionId, order.tenantId, {
      allowSubscriptionShortcut: false,
    });

    if (!checkResult.success || checkResult.status !== "ACCEPTED") {
      return successResponse({
        status: checkResult.status || "PENDING",
        recorded: false,
        message: checkResult.error || "Paiement en attente de confirmation",
      });
    }

    const paidAmountCinet =
      checkResult.amount || Math.max(0, order.totalAmount - order.paidAmount);
    const paymentMethod = mapCinetPayMethod(checkResult.paymentMethod);

    const outcome = await recordOnlineOrderPayment({
      orderId: order.id,
      tenantId: order.tenantId,
      transactionId,
      amountPaid: paidAmountCinet,
      method: paymentMethod,
      note: `Paiement en ligne CinetPay (${checkResult.paymentMethod || "Web"}) - Ref: ${transactionId}`,
      auditProvider: "CINETPAY",
      auditExtra: {
        operatorId: checkResult.operatorId,
      },
    });

    if (outcome.status === "CONFLICT_OTHER_ORDER") {
      return errorResponse("Cette transaction est déjà associée à une autre commande", 409);
    }

    return successResponse({
      status: "ACCEPTED",
      recorded: true,
      amount: outcome.status === "RECORDED" ? outcome.amountRecorded : paidAmountCinet,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
