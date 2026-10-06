import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { getPlanPrice, PlanKey, BillingCycle, SUBSCRIPTION_PLANS } from "@/lib/subscription-plans";
import { createWaveCheckoutSession, isWaveConfigured, WaveApiError } from "@/lib/wave";

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

    const rand = Math.floor(1000 + Math.random() * 9000);
    const cleanTenant = tenant.id.replace(/[^a-zA-Z0-9]/g, "").slice(-6);
    const transactionId = `SUB-${cleanTenant}-${Date.now().toString().slice(-6)}${rand}`;

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const successUrl = `${origin}/subscription?payment=return&provider=wave&tx=${transactionId}`;
    const errorUrl = `${origin}/subscription?payment=error&provider=wave&tx=${transactionId}`;

    // Enregistrer l'intention de paiement
    await prisma.$queryRaw`
      INSERT INTO "SubscriptionPayment" ("id", "tenantId", "plan", "amount", "transactionId", "status", "createdAt", "updatedAt")
      VALUES (${`sp_${transactionId}`}, ${tenant.id}, ${plan}, ${amount}, ${transactionId}, 'PENDING', NOW(), NOW())
    `;

    // 1. Si Wave Checkout API officielle est configurée
    if (isWaveConfigured()) {
      try {
        const waveSession = await createWaveCheckoutSession({
          amount,
          clientReference: transactionId,
          successUrl,
          errorUrl,
          restrictPayerMobile: tenant.phone || undefined,
        });

        return successResponse({
          paymentUrl: waveSession.wave_launch_url,
          sessionId: waveSession.id,
          transactionId,
          amount,
          plan,
          cycle,
          provider: "WAVE",
        });
      } catch (waveErr) {
        console.warn("[Wave Subscription Checkout Warning]", waveErr instanceof Error ? waveErr.message : waveErr);
      }
    }

    // 2. Lien Wave Business officiel réel de la plateforme PressiPro
    const platformWaveUrl = process.env.PLATFORM_WAVE_URL || "https://pay.wave.com/m/M_sn_3em1Iu3-fUxZ/c/sn/";

    return successResponse({
      paymentUrl: platformWaveUrl,
      transactionId,
      amount,
      plan,
      cycle,
      provider: "WAVE_BUSINESS_DIRECT",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
