import { NextRequest, NextResponse } from "next/server";
import { checkCinetPayTransaction, mapCinetPayMethod } from "@/lib/cinetpay";
import {
  findSubscriptionPayment,
  activateSubscriptionFromCinetPay,
} from "@/lib/subscription-billing";
import {
  resolveOrderForTransaction,
  recordOnlineOrderPayment,
} from "@/lib/order-payment-reconcile";

export async function POST(request: NextRequest) {
  try {
    let payload: Record<string, unknown> = {};

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await request.json().catch(() => ({}));
    } else if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        formData.forEach((value, key) => {
          payload[key] = value;
        });
      }
    } else {
      const text = await request.text().catch(() => "");
      try {
        payload = JSON.parse(text);
      } catch {
        const params = new URLSearchParams(text);
        params.forEach((value, key) => {
          payload[key] = value;
        });
      }
    }

    const rawTxId =
      payload.cpm_trans_id ||
      payload.transaction_id ||
      payload.trans_id ||
      payload.cpm_custom;

    if (!rawTxId || typeof rawTxId !== "string") {
      return NextResponse.json({ error: "Missing transaction_id" }, { status: 400 });
    }
    const transactionId = rawTxId.trim();

    let metadata: { orderId?: string; tenantId?: string; orderCode?: string; type?: string } = {};
    if (typeof payload.cpm_custom === "string") {
      try {
        metadata = JSON.parse(payload.cpm_custom);
      } catch {
        // non-JSON
      }
    }

    const isSubscription =
      transactionId.startsWith("SUB-") || metadata.type === "SUBSCRIPTION";

    // 1. Abonnement SaaS : toujours vérifier avec les clés plateforme (jamais celles du tenant !)
    if (isSubscription) {
      const sub = await findSubscriptionPayment(transactionId);
      if (!sub) {
        return NextResponse.json({ error: "Subscription payment not found" }, { status: 404 });
      }

      const checkResult = await checkCinetPayTransaction(transactionId, undefined, {
        allowSubscriptionShortcut: false,
      });

      if (!checkResult.success || checkResult.status !== "ACCEPTED") {
        return NextResponse.json(
          { message: "Status acknowledged", status: checkResult.status },
          { status: 200 }
        );
      }

      await activateSubscriptionFromCinetPay(sub, checkResult, "webhook");
      return NextResponse.json(
        { message: "Subscription payment processed successfully" },
        { status: 200 }
      );
    }

    // 2. Commande Pressing : résoudre d'abord la commande pour utiliser les clés CinetPay du bon tenant
    let preResolvedOrder = await resolveOrderForTransaction(transactionId, metadata);
    const checkResult = await checkCinetPayTransaction(
      transactionId,
      preResolvedOrder?.tenantId || metadata.tenantId,
      { allowSubscriptionShortcut: false }
    );

    if (!checkResult.success || checkResult.status !== "ACCEPTED") {
      return NextResponse.json(
        { message: "Status acknowledged", status: checkResult.status },
        { status: 200 }
      );
    }

    if (!preResolvedOrder && checkResult.metadata) {
      try {
        const verifiedMeta = JSON.parse(checkResult.metadata);
        preResolvedOrder = await resolveOrderForTransaction(transactionId, verifiedMeta);
      } catch {
        // ignore
      }
    }

    if (!preResolvedOrder) {
      console.error(`[CinetPay Webhook] Order not found for transaction ${transactionId}`);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const amountPaid =
      checkResult.amount ?? Math.max(0, preResolvedOrder.totalAmount - preResolvedOrder.paidAmount);
    const paymentMethod = mapCinetPayMethod(checkResult.paymentMethod);

    const outcome = await recordOnlineOrderPayment({
      orderId: preResolvedOrder.id,
      tenantId: preResolvedOrder.tenantId,
      transactionId,
      amountPaid,
      method: paymentMethod,
      note: `Paiement en ligne CinetPay (${checkResult.paymentMethod || "Web"}) - Ref: ${transactionId}`,
      auditProvider: "CINETPAY_WEBHOOK",
      auditExtra: {
        operatorId: checkResult.operatorId,
      },
    });

    if (outcome.status === "CONFLICT_OTHER_ORDER") {
      return NextResponse.json(
        { error: "Transaction already bound to another order" },
        { status: 409 }
      );
    }

    return NextResponse.json({ message: "Payment processed successfully" }, { status: 200 });
  } catch (error) {
    console.error("[CinetPay Webhook Error]", error);
    return NextResponse.json({ error: "Internal webhook processing error" }, { status: 500 });
  }
}
