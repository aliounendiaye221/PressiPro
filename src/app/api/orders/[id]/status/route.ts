import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { updateOrderStatusSchema } from "@/lib/validators";
import { canTransition, isRollback } from "@/lib/order-status";
import { auditLog } from "@/lib/audit";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { OrderStatus } from "@prisma/client";
import { warmOrderReceiptPdf } from "@/lib/receipt/pdf";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;
    const body = await request.json();
    const data = updateOrderStatusSchema.parse(body);
    const newStatus = data.status as OrderStatus;

    let transitionError: { message: string; status: number } | null = null;
    let previousStatus: OrderStatus | null = null;

    const updated = await prisma.$transaction(async (tx) => {
      const locked = (await tx.$queryRaw`
        SELECT id, status
        FROM "Order"
        WHERE id = ${id} AND "tenantId" = ${session.tenantId} AND "deletedAt" IS NULL
        FOR UPDATE
      `) as Array<{ id: string; status: OrderStatus }>;

      const currentOrder = locked?.[0];
      if (!currentOrder) {
        transitionError = { message: "Commande introuvable", status: 404 };
        return null;
      }

      previousStatus = currentOrder.status;

      if (!canTransition(currentOrder.status, newStatus)) {
        transitionError = {
          message: `Transition ${currentOrder.status} → ${newStatus} non autorisée`,
          status: 400,
        };
        return null;
      }

      if (
        isRollback(currentOrder.status, newStatus) &&
        session.role !== "ADMIN" &&
        session.role !== "SUPER_ADMIN"
      ) {
        transitionError = {
          message: "Seul un administrateur ou un super-administrateur peut annuler un statut",
          status: 403,
        };
        return null;
      }

      const p = tx as typeof prisma;
      const updatedOrder = await p.order.update({
        where: { id },
        data: { status: newStatus },
      });

      await p.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: currentOrder.status,
          toStatus: newStatus,
          changedBy: session.userId,
          note: data.note || null,
        },
      });

      return updatedOrder;
    });

    if (transitionError) {
      const err: { message: string; status: number } = transitionError;
      return errorResponse(err.message, err.status);
    }

    if (!updated) {
      return errorResponse("Commande introuvable", 404);
    }

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "STATUS_CHANGE",
      entity: "Order",
      entityId: id,
      details: { from: previousStatus, to: newStatus, note: data.note },
    });

    if (newStatus === "PRET") {
      void warmOrderReceiptPdf({
        tenantId: session.tenantId,
        orderId: id,
      }).catch((error) => {
        console.warn("[ReceiptWarmup] PRET status warmup failed", {
          tenantId: session.tenantId,
          orderId: id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
