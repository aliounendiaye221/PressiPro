import { NextRequest, NextResponse } from "next/server";
import { verifyWaveWebhookSignature, WaveWebhookEvent } from "@/lib/wave";
import {
  findSubscriptionPayment,
  activateSubscriptionFromWave,
} from "@/lib/subscription-billing";
import {
  resolveOrderForTransaction,
  recordOnlineOrderPayment,
} from "@/lib/order-payment-reconcile";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signatureHeader = request.headers.get("wave-signature");
    const webhookSecret = process.env.WAVE_WEBHOOK_SECRET;

    // Fail-closed en production : refuser tout webhook non signé si le secret n'est pas configuré
    if (!webhookSecret) {
      if (process.env.NODE_ENV === "production") {
        console.error("[Wave Webhook] WAVE_WEBHOOK_SECRET manquant en production");
        return NextResponse.json(
          { error: "Webhook secret not configured" },
          { status: 503 }
        );
      }
    } else {
      const isValid = verifyWaveWebhookSignature(signatureHeader, rawBody, webhookSecret);
      if (!isValid) {
        console.warn("[Wave Webhook] Signature invalide ou expirée");
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

    if (type === "checkout.session.completed" && session.payment_status === "succeeded") {
      // 1. Cas Abonnement SaaS PressiPro (SUB-...)
      if (ref.startsWith("SUB-")) {
        const sub = await findSubscriptionPayment(ref);
        if (sub) {
          await activateSubscriptionFromWave(sub, session, "webhook");
        } else {
          console.warn(`[Wave Webhook] SubscriptionPayment introuvable pour ref: ${ref}`);
        }
        return NextResponse.json({ received: true, type: "subscription" }, { status: 200 });
      }

      // 2. Cas Paiement Commande Pressing (PPO-...)
      if (ref.startsWith("PPO-")) {
        const order = await resolveOrderForTransaction(ref);
        if (order) {
          const amountPaid = Math.round(Number(session.amount) || 0);
          const waveTxId = session.transaction_id || session.id;
          await recordOnlineOrderPayment({
            orderId: order.id,
            tenantId: order.tenantId,
            transactionId: ref,
            amountPaid,
            method: "WAVE",
            note: `Paiement en ligne Wave (Réf Wave: ${waveTxId}) - Réf: ${ref}`,
            auditProvider: "WAVE_WEBHOOK",
            auditExtra: {
              waveSessionId: session.id,
              waveTxId,
            },
          });
        } else {
          console.warn(`[Wave Webhook] Commande introuvable ou ambiguë pour ref: ${ref}`);
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
