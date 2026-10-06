import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { getPlanPrice, PlanKey, BillingCycle, SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";
import { initiateCinetPayPayment } from "@/lib/cinetpay";

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json().catch(() => ({}));

    const plan = (body.plan || "PRO") as PlanKey;
    const cycle = (body.cycle || "monthly") as BillingCycle;

    if (!SUBSCRIPTION_PLANS[plan] || plan === "FREE") {
      return errorResponse("Plan d'abonnement sélectionné invalide", 400);
    }

    const amount = getPlanPrice(plan, cycle);
    if (amount <= 0) {
      return errorResponse("Montant d'abonnement invalide", 400);
    }

    // Récupérer le tenant et l'utilisateur
    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { id: true, name: true, phone: true },
    });

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { name: true, email: true },
    });

    if (!tenant) {
      return errorResponse("Tenant introuvable", 404);
    }

    // ID de transaction unique pour l'abonnement
    const rand = Math.floor(1000 + Math.random() * 9000);
    const cleanTenant = tenant.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6);
    const transactionId = `SUB-${cleanTenant}-${Date.now().toString().slice(-6)}${rand}`;

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const notifyUrl = `${origin}/api/webhooks/cinetpay`;
    const returnUrl = `${origin}/subscription?payment=return&tx=${transactionId}`;

    // Enregistrer l'intention de paiement dans SubscriptionPayment
    await prisma.$queryRaw`
      INSERT INTO "SubscriptionPayment" ("id", "tenantId", "plan", "amount", "transactionId", "status", "createdAt", "updatedAt")
      VALUES (${`sp_${transactionId}`}, ${tenant.id}, ${plan}, ${amount}, ${transactionId}, 'PENDING', NOW(), NOW())
    `;

    // Appel CinetPay unifié (avec gestion automatique moderne, legacy et simulation)
    const result = await initiateCinetPayPayment({
      amount,
      orderId: `sp_${transactionId}`,
      orderCode: `SUB-${plan}`,
      customerName: user?.name || tenant.name,
      customerPhone: tenant.phone,
      customerEmail: user?.email,
      tenantId: tenant.id,
      tenantName: tenant.name,
      notifyUrl,
      returnUrl,
      transactionId,
      description: `Abonnement PressiPro ${plan} (${cycle === "yearly" ? "Annuel" : "Mensuel"}) - ${tenant.name}`,
      metadata: {
        type: "SUBSCRIPTION",
        tenantId: tenant.id,
        plan,
        cycle,
        amount,
      },
    });

    if (!result.success || !result.paymentUrl) {
      return errorResponse(result.error || "Impossible d'initialiser le paiement d'abonnement", 400);
    }

    return successResponse({
      paymentUrl: result.paymentUrl,
      transactionId,
      amount,
      plan,
      cycle,
      isSimulated: result.isSimulated,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
