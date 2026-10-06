import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkCinetPayTransaction, mapCinetPayMethod } from "@/lib/cinetpay";
import { auditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    let payload: Record<string, any> = {};

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await request.json().catch(() => ({}));
    } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData().catch(() => null);
      if (formData) {
        formData.forEach((value, key) => {
          payload[key] = value;
        });
      }
    } else {
      // Fallback text parsing
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

    const transactionId =
      payload.cpm_trans_id ||
      payload.transaction_id ||
      payload.trans_id ||
      payload.cpm_custom;

    if (!transactionId || typeof transactionId !== "string") {
      console.warn("[CinetPay Webhook] No transaction_id found in payload:", payload);
      return NextResponse.json({ error: "Missing transaction_id" }, { status: 400 });
    }

    console.log(`[CinetPay Webhook] Processing notification for transaction ${transactionId}`);

    // Parse metadata si disponible
    let metadata: { orderId?: string; tenantId?: string; orderCode?: string; type?: string } = {};
    if (payload.cpm_custom) {
      try {
        metadata = JSON.parse(payload.cpm_custom);
      } catch {
        // non-JSON
      }
    }

    // 1. Vérification sécurisée et certifiée auprès de l'API CinetPay (anti-spoofing)
    const checkResult = await checkCinetPayTransaction(transactionId, metadata.tenantId);

    if (!checkResult.success || checkResult.status !== "ACCEPTED") {
      console.log(`[CinetPay Webhook] Transaction ${transactionId} status is: ${checkResult.status}`);
      return NextResponse.json({ message: "Status acknowledged", status: checkResult.status }, { status: 200 });
    }
    // Si c'est un paiement d'abonnement SaaS PressiPro (SUB-...)
    if (transactionId.startsWith("SUB-") || metadata.type === "SUBSCRIPTION") {
      console.log(`[CinetPay Webhook] Processing SaaS Subscription payment: ${transactionId}`);
      try {
        const subRows = (await prisma.$queryRaw`
          SELECT id, "tenantId", plan, amount, status
          FROM "SubscriptionPayment"
          WHERE "transactionId" = ${transactionId}
          LIMIT 1
        `) as Array<{ id: string; tenantId: string; plan: string; amount: number; status: string }>;

        const sub = subRows?.[0];
        if (sub && sub.status !== "SUCCESS") {
          const isYearly = sub.amount >= 100000;
          const daysToAdd = isYearly ? 365 : 30;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + daysToAdd);

          await prisma.$queryRaw`
            UPDATE "SubscriptionPayment"
            SET status = 'SUCCESS',
                "operatorId" = ${checkResult.operatorId || null},
                "paymentMethod" = ${checkResult.paymentMethod || null},
                "updatedAt" = NOW()
            WHERE "transactionId" = ${transactionId}
          `;

          await prisma.$queryRaw`
            UPDATE "Tenant"
            SET subscription = ${sub.plan},
                "subscribedAt" = NOW(),
                "subscriptionExpiresAt" = ${expiresAt},
                "updatedAt" = NOW()
            WHERE id = ${sub.tenantId}
          `;

          await auditLog({
            tenantId: sub.tenantId,
            action: "SUBSCRIPTION_ACTIVATED_WEBHOOK",
            entity: "Tenant",
            entityId: sub.tenantId,
            details: {
              plan: sub.plan,
              amount: sub.amount,
              transactionId,
              paymentMethod: checkResult.paymentMethod,
              expiresAt: expiresAt.toISOString(),
            },
          });
        }
      } catch (subErr) {
        console.error("[CinetPay Webhook Subscription Error]", subErr);
      }
      return NextResponse.json({ message: "Subscription payment processed successfully" }, { status: 200 });
    }

    // Si metadata ne contenait pas l'orderId, on extrait depuis metadata retourné par le check
    if (!metadata.orderId && checkResult.metadata) {
      try {
        metadata = JSON.parse(checkResult.metadata);
      } catch {
        // ignore
      }
    }

    // Recherche de la commande
    let order = null;
    if (metadata.orderId) {
      order = await prisma.order.findUnique({
        where: { id: metadata.orderId },
        include: { payments: { select: { note: true } } },
      });
    }

    // Fallback: recherche par code de commande présent dans l'ID de transaction (PPO-P00123-...)
    if (!order) {
      const parts = transactionId.split("-");
      if (parts.length >= 2) {
        const potentialCode = parts[1];
        order = await prisma.order.findFirst({
          where: { code: potentialCode, deletedAt: null },
          include: { payments: { select: { note: true } } },
        });
      }
    }

    if (!order) {
      console.error(`[CinetPay Webhook] Order not found for transaction ${transactionId}`);
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // 2. Vérification d'idempotence : ne pas créer de doublon de paiement
    const alreadyRecorded = order.payments.some((p: { note?: string | null }) =>
      p.note?.includes(transactionId)
    );

    if (alreadyRecorded) {
      console.log(`[CinetPay Webhook] Payment already recorded for transaction ${transactionId}`);
      return NextResponse.json({ message: "Payment already processed" }, { status: 200 });
    }

    const amountPaid = checkResult.amount || (order.totalAmount - order.paidAmount);
    const paymentMethod = mapCinetPayMethod(checkResult.paymentMethod);

    // 3. Enregistrement transactionnel atomique
    await prisma.$transaction(async (tx) => {
      const currentOrder = await tx.order.findUnique({
        where: { id: order.id },
        select: { id: true, totalAmount: true, paidAmount: true },
      });

      if (!currentOrder) return;

      const remaining = currentOrder.totalAmount - currentOrder.paidAmount;
      const amountToRecord = Math.min(amountPaid, Math.max(0, remaining));

      if (amountToRecord <= 0) return;

      const note = `Paiement en ligne CinetPay (${checkResult.paymentMethod || "Web"}) - Ref: ${transactionId}`;

      await tx.payment.create({
        data: {
          tenantId: order.tenantId,
          orderId: order.id,
          amount: amountToRecord,
          method: paymentMethod,
          note,
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: {
          paidAmount: { increment: amountToRecord },
        },
      });
    });

    await auditLog({
      tenantId: order.tenantId,
      action: "PAYMENT_CREATED",
      entity: "Payment",
      entityId: order.id,
      details: {
        provider: "CINETPAY_WEBHOOK",
        transactionId,
        amount: amountPaid,
        paymentMethod,
      },
    });

    console.log(`[CinetPay Webhook] Payment recorded successfully for order ${order.code}`);
    return NextResponse.json({ message: "Payment processed successfully" }, { status: 200 });
  } catch (error) {
    console.error("[CinetPay Webhook Error]", error);
    return NextResponse.json({ error: "Internal webhook processing error" }, { status: 500 });
  }
}
