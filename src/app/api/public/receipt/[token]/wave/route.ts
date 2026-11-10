import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyReceiptShareToken } from "@/lib/receipt-share";
import { createWaveCheckoutSession, isWaveConfigured } from "@/lib/wave";
import { generateTransactionId } from "@/lib/cinetpay";
import { normalizeSafeWaveMerchantUrl } from "@/lib/order-payment-reconcile";
import { errorResponse, successResponse, handleApiError } from "@/lib/api-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(`public:wave:init:${clientIp}`, 10, 60 * 1000);
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
        tenant: { active: true },
      },
      include: {
        customer: true,
        tenant: {
          select: {
            name: true,
            phone: true,
            waveNumber: true,
            omNumber: true,
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

    let bodyAmount: number | undefined;
    try {
      const body = await request.json();
      if (body?.amount && typeof body.amount === "number") {
        bodyAmount = body.amount;
      }
    } catch {
      // ignore
    }

    const paymentAmount =
      bodyAmount && bodyAmount > 0 && bodyAmount <= amountDue
        ? Math.round(bodyAmount)
        : amountDue;

    const transactionId = generateTransactionId(order.code, {
      tenantId: order.tenantId,
      orderId: order.id,
    });
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const successUrl = `${origin}/share/receipt/${token}?payment=return&provider=wave&tx=${encodeURIComponent(transactionId)}`;
    const errorUrl = `${origin}/share/receipt/${token}?payment=error&provider=wave&tx=${encodeURIComponent(transactionId)}`;

    // 1. Lien Wave Business Marchand validé strictement (uniquement domaine *.wave.com en HTTPS)
    const safeWaveUrl = normalizeSafeWaveMerchantUrl(order.tenant.waveNumber);
    if (safeWaveUrl) {
      return successResponse({
        paymentUrl: safeWaveUrl,
        directWaveNumber: null,
        tenantName: order.tenant.name,
        orderCode: order.code,
        amount: paymentAmount,
        provider: "WAVE_BUSINESS_LINK",
      });
    }

    // 2. Si Wave Checkout API est configuré
    if (isWaveConfigured()) {
      try {
        const waveSession = await createWaveCheckoutSession({
          amount: paymentAmount,
          clientReference: transactionId,
          successUrl,
          errorUrl,
          restrictPayerMobile: order.customer.phone || undefined,
        });

        return successResponse({
          paymentUrl: waveSession.wave_launch_url,
          sessionId: waveSession.id,
          transactionId,
          amount: paymentAmount,
          provider: "WAVE",
        });
      } catch (waveErr) {
        console.warn(
          "[Wave Public Receipt Error]",
          waveErr instanceof Error ? waveErr.message : waveErr
        );
      }
    }

    // 3. Si le pressing dispose d'un numéro de téléphone Wave
    const phoneTarget = (order.tenant.waveNumber || order.tenant.phone || "").trim();
    const cleanPhone = phoneTarget.replace(/[^0-9]/g, "");
    if (cleanPhone.length >= 8) {
      return successResponse({
        paymentUrl: null,
        directWaveNumber: cleanPhone,
        tenantName: order.tenant.name,
        orderCode: order.code,
        amount: paymentAmount,
        provider: "WAVE_DIRECT_NUMBER",
      });
    }

    return errorResponse(
      "La passerelle de paiement Wave n'est pas encore configurée sur ce pressing.",
      500
    );
  } catch (error) {
    return handleApiError(error);
  }
}
