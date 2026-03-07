import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { updateOrderStatusSchema } from "@/lib/validators";
import { canTransition, isRollback } from "@/lib/order-status";
import { auditLog } from "@/lib/audit";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { OrderStatus } from "@prisma/client";

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

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    if (!canTransition(order.status, newStatus)) {
      return errorResponse(
        `Transition ${order.status} → ${newStatus} non autorisée`,
        400
      );
    }

    // Rollback requires ADMIN
    if (isRollback(order.status, newStatus) && session.role !== "ADMIN") {
      return errorResponse("Seul un administrateur peut annuler un statut", 403);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { id },
        data: { status: newStatus },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          fromStatus: order.status,
          toStatus: newStatus,
          changedBy: session.userId,
          note: data.note || null,
        },
      });

      return updatedOrder;
    });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "STATUS_CHANGE",
      entity: "Order",
      entityId: id,
      details: { from: order.status, to: newStatus, note: data.note },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
