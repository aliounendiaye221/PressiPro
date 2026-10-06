import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auditLog } from "@/lib/audit";
import { verifyWaveWebhookSignature, WaveWebhookEvent, WaveCheckoutSession } from "@/lib/wave";
import { findSubscriptionPayment, activateSubscriptionFromWave } from "@/lib/subscription-billing";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("wave-signature");

    // Vérification de la signature HMAC-SHA256 si WAVE_WEBHOOK_SECRET est défini
    const webhookSecret = process.env.WAVE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const isValid = verifyWaveWebhookSignature(signatureHeader, rawBody, webhookSecret);
      if (!isValid) {
        console.warn("[Wave Webhook] Signature invalide");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    let event: WaveWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { type, data: session } = event;

    if (!session || !session.client_reference) {
      return NextResponse.json({ received: true, note: "No client_reference" }, { status: 200 });
    }

    const ref = session.client_reference;
    console.log(`[Wave Webhook] Événement '${type}' reçu pour ref: ${ref}, status: ${session.payment_status}`);

    if (type === "checkout.session.completed" && session.payment_status === "succeeded") {
      // 1. Cas Abonnement SaaS PressiPro (SUB-...)
      if (ref.startsWith("SUB-")) {
        const sub = await findSubscriptionPayment(ref);
        if (sub) {
          const res = await activateSubscriptionFromWave(sub, session, "webhook");
          console.log(`[Wave Webhook] Activation abonnement ${ref}:`, res);
        } else {
          console.warn(`[Wave Webhook] SubscriptionPayment introuvable pour ref: ${ref}`);
        }
        return NextResponse.json({ received: true, type: "subscription" }, { status: 200 });
      }

      // 2. Cas Paiement Commande Pressing (PPO-...)
      if (ref.startsWith("PPO-")) {
        const parts = ref.split("-");
        const orderCode = parts[1];

        if (orderCode) {
          const order = await prisma.order.findFirst({
            where: { code: orderCode, deletedAt: null },
            include: { payments: { select: { note: true } } },
          });

          if (order) {
            const alreadyRecorded = order.payments.some((p: { note?: string | null }) =>
              p.note?.includes(ref) || (session.transaction_id && p.note?.includes(session.transaction_id))
            );

            if (!alreadyRecorded) {
              const amountPaid = Math.round(Number(session.amount));
              const remaining = Math.max(0, order.totalAmount - order.paidAmount);
              const toRecord = Math.min(amountPaid, remaining);

              if (toRecord > 0) {
                const waveTxId = session.transaction_id || session.id;
                const note = `Paiement en ligne Wave (Réf Wave: ${waveTxId}) - Réf: ${ref}`;

                await prisma.$transaction(async (tx) => {
                  await tx.payment.create({
                    data: {
                      tenantId: order.tenantId,
                      orderId: order.id,
                      amount: toRecord,
                      method: "WAVE",
                      note,
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
                    provider: "WAVE_WEBHOOK",
                    transactionId: ref,
                    waveSessionId: session.id,
                    waveTxId,
                    amount: toRecord,
                    paymentMethod: "WAVE",
                  },
                });

                console.log(`[Wave Webhook] Paiement commande ${order.code} enregistré avec succès (${toRecord} FCFA)`);
              }
            }
          }
        }

        return NextResponse.json({ received: true, type: "order" }, { status: 200 });
      }
    }

    return NextResponse.json({ received: true, status: session.payment_status }, { status: 200 });
  } catch (error) {
    console.error("[Wave Webhook Error]", error);
    return NextResponse.json({ error: "Internal webhook error" }, { status: 500 });
  }
}
