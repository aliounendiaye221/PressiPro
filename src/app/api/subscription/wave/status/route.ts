import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { isWaveConfigured, searchWaveCheckoutSessions } from "@/lib/wave";
import { findSubscriptionPayment, activateSubscriptionFromWave } from "@/lib/subscription-billing";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get("tx");

    if (!transactionId) {
      return errorResponse("Identifiant de transaction manquant", 400);
    }

    const subPayment = await findSubscriptionPayment(transactionId);

    if (!subPayment || subPayment.tenantId !== session.tenantId) {
      return errorResponse("Paiement d'abonnement introuvable pour ce compte", 404);
    }

    // 1. Déjà validé (par webhook ou précédent appel)
    if (subPayment.status === "SUCCESS") {
      return successResponse({
        status: "SUCCESS",
        plan: subPayment.plan,
        alreadyProcessed: true,
      });
    }

    // 2. Interrogation directe de l'API Wave Checkout pour confirmer l'état
    if (isWaveConfigured()) {
      try {
        const matches = await searchWaveCheckoutSessions(transactionId);
        const waveSession = matches?.[0];

        if (waveSession && waveSession.payment_status === "succeeded") {
          const result = await activateSubscriptionFromWave(subPayment, waveSession, "return");
          if (result.activated) {
            return successResponse({
              status: "SUCCESS",
              plan: subPayment.plan,
              expiresAt: result.expiresAt.toISOString(),
            });
          }
        } else if (waveSession) {
          return successResponse({
            status: waveSession.payment_status === "cancelled" ? "FAILED" : "PENDING",
            message: "Paiement Wave en cours de finalisation",
          });
        }
      } catch (err) {
        console.warn("[Wave Status Check Warning]", err instanceof Error ? err.message : err);
      }
    }

    // En cours ou en attente
    return successResponse({
      status: "PENDING",
      message: "Paiement en cours de validation par Wave",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
