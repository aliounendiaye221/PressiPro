import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { createReceiptShareToken } from "@/lib/receipt-share";
import { createWaveCheckoutSession, isWaveConfigured, WaveApiError } from "@/lib/wave";
import { generateTransactionId } from "@/lib/cinetpay";
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
            waveNumber: true,
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

    const transactionId = generateTransactionId(order.code);
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const successUrl = `${origin}/share/receipt/${token}?payment=return&provider=wave&tx=${transactionId}`;
    const errorUrl = `${origin}/share/receipt/${token}?payment=error&provider=wave&tx=${transactionId}`;
    const receiptShareUrl = `${origin}/share/receipt/${token}`;

    let directPaymentUrl: string | null = null;

    // 1. Si le pressing a configuré son propre lien Wave Business Marchand (ex: pay.wave.com/m/...)
    const tenantWave = (order.tenant.waveNumber || "").trim();
    const isWaveUrl =
      tenantWave.startsWith("http://") ||
      tenantWave.startsWith("https://") ||
      tenantWave.includes("pay.wave.com") ||
      tenantWave.includes("wave.com");

    if (isWaveUrl) {
      directPaymentUrl = tenantWave.startsWith("http") ? tenantWave : `https://${tenantWave}`;
    } else if (isWaveConfigured()) {
      try {
        const waveSession = await createWaveCheckoutSession({
          amount: amountDue,
          clientReference: transactionId,
          successUrl,
          errorUrl,
          restrictPayerMobile: order.customer.phone || undefined,
        });
        directPaymentUrl = waveSession.wave_launch_url;
      } catch (waveErr) {
        console.warn("[Wave Order Checkout Warning]", waveErr instanceof Error ? waveErr.message : waveErr);
      }
    }

    const paymentLinkToUse = directPaymentUrl || receiptShareUrl;
    const whatsappMessage = `Bonjour ${order.customer.name}, voici votre lien pour régler votre commande de pressing ${order.code} chez ${order.tenant.name} (Montant : ${amountDue.toLocaleString("fr-FR")} FCFA) :\n${paymentLinkToUse}\n\nPaiement direct et sécurisé via Wave.`;

    return successResponse({
      orderCode: order.code,
      amountDue,
      directPaymentUrl,
      receiptShareUrl,
      paymentLink: paymentLinkToUse,
      transactionId,
      whatsappMessage,
      provider: "WAVE",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
