import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { registerSimulatedTransaction } from "@/lib/cinetpay";
import { auditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      transactionId,
      amount,
      method = "WAVE",
      status = "ACCEPTED",
      notifyUrl,
      tenantId: passedTenantId,
    } = body;

    if (!transactionId) {
      return NextResponse.json({ error: "Identifiant de transaction manquant" }, { status: 400 });
    }

    const numAmount = Number(amount) || 0;
    const nowIso = new Date().toISOString();

    // 1. Enregistrer dans le registre en mémoire pour checkCinetPayTransaction
    registerSimulatedTransaction({
      transactionId,
      amount: numAmount,
      status: status === "ACCEPTED" ? "ACCEPTED" : "REFUSED",
      paymentMethod: method,
      date: nowIso,
    });

    if (status === "ACCEPTED") {
      // 2. Si c'est un abonnement SaaS PressiPro (SUB-...)
      if (transactionId.startsWith("SUB-")) {
        const subRows = (await prisma.$queryRaw`
          SELECT id, "tenantId", plan, amount, status
          FROM "SubscriptionPayment"
          WHERE "transactionId" = ${transactionId}
          LIMIT 1
        `) as Array<{ id: string; tenantId: string; plan: string; amount: number; status: string }>;

        const sub = subRows?.[0];
        if (sub) {
          const isYearly = sub.amount >= 100000;
          const daysToAdd = isYearly ? 365 : 30;
          const expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + daysToAdd);

          await prisma.$queryRaw`
            UPDATE "SubscriptionPayment"
            SET status = 'SUCCESS',
                "operatorId" = ${`SIM_OP_${Date.now()}`},
                "paymentMethod" = ${method},
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
            action: "SUBSCRIPTION_ACTIVATED_SIMULATED",
            entity: "Tenant",
            entityId: sub.tenantId,
            details: {
              plan: sub.plan,
              amount: sub.amount,
              transactionId,
              paymentMethod: method,
              expiresAt: expiresAt.toISOString(),
            },
          });
        }
      }

      // 3. Si c'est une commande pressing (PPO-...)
      if (transactionId.startsWith("PPO-")) {
        const parts = transactionId.split("-");
        const potentialCode = parts[1];

        if (potentialCode) {
          const order = await prisma.order.findFirst({
            where: { code: potentialCode, deletedAt: null },
            include: { payments: { select: { note: true } } },
          });

          if (order) {
            const alreadyRecorded = order.payments.some((p: { note?: string | null }) =>
              p.note?.includes(transactionId)
            );

            if (!alreadyRecorded) {
              const remaining = Math.max(0, order.totalAmount - order.paidAmount);
              const toRecord = numAmount > 0 ? Math.min(numAmount, remaining) : remaining;

              if (toRecord > 0) {
                const note = `Paiement en ligne simulé (${method}) - Ref: ${transactionId}`;

                await prisma.$transaction(async (tx) => {
                  await tx.payment.create({
                    data: {
                      tenantId: order.tenantId,
                      orderId: order.id,
                      amount: toRecord,
                      method: method === "OM" ? "OM" : method === "WAVE" ? "WAVE" : "OTHER",
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
                    provider: "SIMULATED_CHECKOUT",
                    transactionId,
                    amount: toRecord,
                    paymentMethod: method,
                  },
                });
              }
            }
          }
        }
      }

      // 4. Appel webhook en tâche de fond (optionnel)
      if (notifyUrl) {
        try {
          fetch(notifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              cpm_trans_id: transactionId,
              transaction_id: transactionId,
              cpm_amount: numAmount,
              cpm_payment_method: method,
              status: "ACCEPTED",
            }),
          }).catch(() => {
            // ignore webhook fail in simulation
          });
        } catch {
          // ignore
        }
      }
    }

    return NextResponse.json({
      success: true,
      transactionId,
      status: status === "ACCEPTED" ? "ACCEPTED" : "REFUSED",
      message: status === "ACCEPTED" ? "Paiement simulé validé avec succès." : "Paiement simulé refusé.",
    });
  } catch (error) {
    console.error("[CinetPay Simulate Error]", error);
    return NextResponse.json(
      { error: "Erreur lors de la simulation du paiement" },
      { status: 500 }
    );
  }
}
