import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyReceiptShareToken } from "@/lib/receipt-share";
import { initiateCinetPayPayment } from "@/lib/cinetpay";
import { errorResponse, successResponse, handleApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(`public:cinetpay:init:${clientIp}`, 10, 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives de paiement. Veuillez patienter 1 minute." },
        { status: 429 }
      );
    }

    const { token } = await params;
    const payload = await verifyReceiptShareToken(token);

    if (!payload) {
      return errorResponse("Lien de reçu invalide ou expiré", 401);
    }

    const order = await prisma.order.findFirst({
      where: {
        id: payload.orderId,
        tenantId: payload.tenantId,
        deletedAt: null,
      },
      include: {
        customer: true,
        tenant: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    const amountDue = order.totalAmount - order.paidAmount;
    if (amountDue <= 0) {
      return errorResponse("Cette commande est déjà intégralement payée.", 400);
    }

    // Montant à payer (par défaut le solde total)
    let bodyAmount: number | undefined;
    try {
      const body = await request.json();
      if (body?.amount && typeof body.amount === "number") {
        bodyAmount = body.amount;
      }
    } catch {
      // Pas de corps JSON, on prend amountDue par défaut
    }

    const paymentAmount = bodyAmount && bodyAmount > 0 && bodyAmount <= amountDue
      ? Math.round(bodyAmount)
      : amountDue;

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const notifyUrl = `${origin}/api/webhooks/cinetpay`;
    const returnUrl = `${origin}/share/receipt/${token}?payment=return`;

    const result = await initiateCinetPayPayment({
      amount: paymentAmount,
      orderId: order.id,
      orderCode: order.code,
      customerName: order.customer.name,
      customerPhone: order.customer.phone,
      customerEmail: order.customer.email,
      tenantId: order.tenantId,
      tenantName: order.tenant.name,
      notifyUrl,
      returnUrl,
      customToken: token,
    });

    if (!result.success || !result.paymentUrl) {
      return errorResponse(result.error || "Impossible d'initialiser le paiement CinetPay", 400);
    }

    return successResponse({
      paymentUrl: result.paymentUrl,
      transactionId: result.transactionId,
      amount: paymentAmount,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
