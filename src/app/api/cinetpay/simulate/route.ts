import { NextRequest, NextResponse } from "next/server";
import {
  isSimulationAllowedInEnv,
  registerSimulatedTransaction,
  mapCinetPayMethod,
} from "@/lib/cinetpay";
import {
  findSubscriptionPayment,
  activateSubscriptionFromCinetPay,
} from "@/lib/subscription-billing";
import {
  resolveOrderForTransaction,
  recordOnlineOrderPayment,
} from "@/lib/order-payment-reconcile";

export async function POST(request: NextRequest) {
  // Interdit formellement en production (sauf bac à sable explicitement activé par CINETPAY_SIMULATE="true")
  if (!isSimulationAllowedInEnv()) {
    return NextResponse.json({ error: "Ressource introuvable" }, { status: 404 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      transactionId,
      amount,
      method = "WAVE",
      status = "ACCEPTED",
      tenantId: passedTenantId,
    } = body;

    if (!transactionId || typeof transactionId !== "string") {
      return NextResponse.json(
        { error: "Identifiant de transaction manquant" },
        { status: 400 }
      );
    }

    const numAmount = Math.max(0, Math.round(Number(amount) || 0));
    const nowIso = new Date().toISOString();

    registerSimulatedTransaction({
      transactionId,
      amount: numAmount,
      status: status === "ACCEPTED" ? "ACCEPTED" : "REFUSED",
      paymentMethod: method,
      date: nowIso,
    });

    if (status === "ACCEPTED") {
      if (transactionId.startsWith("SUB-")) {
        const sub = await findSubscriptionPayment(transactionId);
        if (sub) {
          await activateSubscriptionFromCinetPay(
            sub,
            {
              success: true,
              status: "ACCEPTED",
              amount: numAmount || sub.amount,
              currency: "XOF",
              paymentMethod: method,
              operatorId: `SIM_OP_${Date.now()}`,
              transactionId,
            },
            "simulated"
          );
        }
      } else if (transactionId.startsWith("PPO-")) {
        const order = await resolveOrderForTransaction(transactionId, {
          tenantId: typeof passedTenantId === "string" ? passedTenantId : undefined,
        });

        if (order) {
          const remaining = Math.max(0, order.totalAmount - order.paidAmount);
          const toRecord = numAmount > 0 ? Math.min(numAmount, remaining) : remaining;
          if (toRecord > 0) {
            await recordOnlineOrderPayment({
              orderId: order.id,
              tenantId: order.tenantId,
              transactionId,
              amountPaid: toRecord,
              method: mapCinetPayMethod(method),
              note: `Paiement en ligne simulé (${method}) - Ref: ${transactionId}`,
              auditProvider: "SIMULATED_CHECKOUT",
            });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      transactionId,
      status: status === "ACCEPTED" ? "ACCEPTED" : "REFUSED",
      message:
        status === "ACCEPTED"
          ? "Paiement simulé validé avec succès."
          : "Paiement simulé refusé.",
    });
  } catch (error) {
    console.error("[CinetPay Simulate Error]", error);
    return NextResponse.json(
      { error: "Erreur lors de la simulation du paiement" },
      { status: 500 }
    );
  }
}
