import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { checkCinetPayTransaction } from "@/lib/cinetpay";
import {
  findSubscriptionPayment,
  activateSubscriptionFromCinetPay,
} from "@/lib/subscription-billing";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("tx");

    if (!transactionId || !transactionId.startsWith("SUB-")) {
      return errorResponse("Identifiant de transaction invalide", 400);
    }

    const subPayment = await findSubscriptionPayment(transactionId);

    if (!subPayment || subPayment.tenantId !== session.tenantId) {
      return errorResponse("Paiement d'abonnement introuvable pour ce compte", 404);
    }

    if (subPayment.status === "SUCCESS") {
      return successResponse({
        status: "SUCCESS",
        plan: subPayment.plan,
        alreadyProcessed: true,
      });
    }

    // Toujours vérifier avec les clés plateforme (tenantId = undefined)
    const checkResult = await checkCinetPayTransaction(transactionId, undefined, {
      allowSubscriptionShortcut: true,
    });

    if (!checkResult.success || checkResult.status !== "ACCEPTED") {
      return successResponse({
        status: checkResult.status || "PENDING",
        message: checkResult.error || "Paiement en cours de validation",
      });
    }

    const activation = await activateSubscriptionFromCinetPay(
      subPayment,
      checkResult,
      "return"
    );

    if (!activation.activated) {
      if (activation.reason === "already-processed") {
        return successResponse({
          status: "SUCCESS",
          plan: subPayment.plan,
          alreadyProcessed: true,
        });
      }
      return errorResponse(
        `Validation du paiement refusée (${activation.detail || activation.reason})`,
        400
      );
    }

    return successResponse({
      status: "SUCCESS",
      plan: subPayment.plan,
      expiresAt: activation.expiresAt.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
