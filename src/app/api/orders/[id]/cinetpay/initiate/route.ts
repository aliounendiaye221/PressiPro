import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { createReceiptShareToken } from "@/lib/receipt-share";
import { initiateCinetPayPayment } from "@/lib/cinetpay";
import { errorResponse, successResponse, handleApiError } from "@/lib/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id: orderId } = await params;

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        tenantId: session.tenantId,
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
      return errorResponse("Cette commande est déjà totalement soldée.", 400);
    }

    const token = await createReceiptShareToken({
      orderId: order.id,
      tenantId: order.tenantId,
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const notifyUrl = `${origin}/api/webhooks/cinetpay`;
    const returnUrl = `${origin}/share/receipt/${token}?payment=return`;
    const receiptShareUrl = `${origin}/share/receipt/${token}`;

    const cinetpayResult = await initiateCinetPayPayment({
      amount: amountDue,
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

    const directPaymentUrl = cinetpayResult.success ? cinetpayResult.paymentUrl : null;
    const paymentLinkToUse = directPaymentUrl || receiptShareUrl;

    const whatsappMessage = `Bonjour ${order.customer.name}, voici le lien pour régler votre commande de pressing ${order.code} chez ${order.tenant.name} (Reste à payer : ${amountDue.toLocaleString("fr-FR")} FCFA) :\n${paymentLinkToUse}\n\nPaiement sécurisé disponible par Wave, Orange Money, Free Money ou Carte bancaire.`;

    return successResponse({
      orderCode: order.code,
      amountDue,
      directPaymentUrl,
      receiptShareUrl,
      paymentLink: paymentLinkToUse,
      transactionId: cinetpayResult.transactionId,
      whatsappMessage,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
