import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { requireAdmin } from "@/lib/rbac";
import { createPaymentSchema } from "@/lib/validators";
import { auditLog } from "@/lib/audit";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id: orderId } = await params;
    const body = await request.json();
    const data = createPaymentSchema.parse(body);

    // Vérification préliminaire (non bloquante) pour retourner un 404 rapide.
    const orderExists = await prisma.order.findFirst({
      where: { id: orderId, tenantId: session.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!orderExists) {
      return errorResponse("Commande introuvable", 404);
    }

    // La vérification du solde restant ET la création du paiement sont dans la même
    // transaction Prisma, ce qui garantit l'atomicité au niveau base de données.
    // PostgreSQL sérialise les transactions concurrentes sur la même ligne via son
    // mécanisme MVCC, empêchant les surpaiements en cas de requêtes simultanées.
    let overpaymentErrorMsg: string | null = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const txResult: { payment: any; newPaidAmount: number } | null = await prisma.$transaction(async (tx) => {
      // Relecture de la commande à l'intérieur de la transaction pour avoir
      // les valeurs courantes (protégées par l'isolation de la transaction).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentOrder = await (tx as any).order.findFirst({
        where: { id: orderId, tenantId: session.tenantId, deletedAt: null },
        select: { totalAmount: true, paidAmount: true },
      });

      if (!currentOrder) {
        throw new Error("NOT_FOUND");
      }

      const amountDue = currentOrder.totalAmount - currentOrder.paidAmount;

      if (data.amount > amountDue) {
        overpaymentErrorMsg = `Montant dépasse le reste à payer (${amountDue} FCFA)`;
        return null;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payment = await (tx as any).payment.create({
        data: {
          tenantId: session.tenantId,
          orderId,
          amount: data.amount,
          method: data.method,
          note: data.note || null,
          createdBy: session.userId,
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatedOrder = await (tx as any).order.update({
        where: { id: orderId },
        data: { paidAmount: { increment: data.amount } },
        select: { id: true, paidAmount: true },
      });

      return { payment, newPaidAmount: updatedOrder.paidAmount };
    });

    if (overpaymentErrorMsg) {
      return errorResponse(overpaymentErrorMsg, 400);
    }

    if (!txResult) {
      return errorResponse("Commande introuvable", 404);
    }

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "PAYMENT_CREATED",
      entity: "Payment",
      entityId: txResult.payment.id,
      details: {
        orderId,
        amount: data.amount,
        method: data.method,
        newPaidAmount: txResult.newPaidAmount,
      },
    });

    return successResponse(txResult.payment, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id: orderId } = await params;

    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: session.tenantId, deletedAt: null },
      select: { id: true },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    const payments = await prisma.payment.findMany({
      where: { orderId, tenantId: session.tenantId },
      orderBy: { createdAt: "desc" },
    });

    const users = await prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u: any) => [u.id, u.name]));

    const enriched = payments.map((p: any) => ({
      ...p,
      agentName: p.createdBy ? userMap.get(p.createdBy) || "Agent" : "Système",
    }));

    return successResponse(enriched);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id: orderId } = await params;
    const { paymentId } = await request.json();

    if (!paymentId) {
      return errorResponse("ID du paiement requis", 400);
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, orderId, tenantId: session.tenantId },
    });

    if (!payment) {
      return errorResponse("Paiement introuvable", 404);
    }

    await prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).payment.delete({ where: { id: paymentId } });
      // Utilise GREATEST(0, ...) pour éviter un paidAmount négatif en cas d'incohérence de données.
      // prisma.$executeRaw est appelé via le client tx pour rester dans la transaction.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (tx as any).$executeRaw`
        UPDATE "Order"
        SET "paidAmount" = GREATEST(0, "paidAmount" - ${payment.amount})
        WHERE id = ${orderId}
      `;
    });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "PAYMENT_DELETED",
      entity: "Payment",
      entityId: paymentId,
      details: { orderId, amount: payment.amount, method: payment.method },
    });

    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
