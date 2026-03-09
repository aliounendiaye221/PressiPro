import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        customer: true,
        items: {
          include: { service: { select: { id: true, name: true } } },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    return successResponse(order);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId },
      include: { items: true },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    // Only allow editing orders not yet delivered
    if (order.status === "LIVRE") {
      return errorResponse("Impossible de modifier une commande livrée", 400);
    }

    const updateData: Record<string, unknown> = {};

    // Update notes
    if (body.notes !== undefined) {
      updateData.notes = body.notes || null;
    }

    // Update promisedAt
    if (body.promisedAt !== undefined) {
      updateData.promisedAt = body.promisedAt ? new Date(body.promisedAt) : null;
    }

    // Update items if provided
    if (Array.isArray(body.items) && body.items.length > 0) {
      // Verify services belong to tenant
      const serviceIds = body.items.map((i: { serviceId: string }) => i.serviceId);
      const services = await prisma.service.findMany({
        where: { id: { in: serviceIds }, tenantId: session.tenantId, active: true },
      });
      if (services.length !== serviceIds.length) {
        return errorResponse("Un ou plusieurs services sont invalides", 400);
      }

      const serviceMap = new Map(services.map((s) => [s.id, s]));
      let newTotal = 0;
      const newItems = body.items.map((item: { serviceId: string; quantity?: number; weight?: number }) => {
        const svc = serviceMap.get(item.serviceId)!;
        const isPerKg = (svc as unknown as { pricingType: string }).pricingType === "PER_KG";
        const quantity = isPerKg ? 1 : (item.quantity ?? 1);
        const weight = isPerKg ? (item.weight ?? 1) : null;
        const total = isPerKg
          ? Math.round(svc.price * (weight ?? 1))
          : svc.price * quantity;
        newTotal += total;
        return {
          serviceId: svc.id,
          name: svc.name,
          quantity,
          unitPrice: svc.price,
          weight,
          pricingType: (svc as unknown as { pricingType: string }).pricingType,
          total,
        };
      });

      // Transaction: delete old items, create new, update totals
      const updated = await prisma.$transaction(async (tx) => {
        await tx.orderItem.deleteMany({ where: { orderId: id } });
        const updatedOrder = await tx.order.update({
          where: { id },
          data: {
            ...updateData,
            totalAmount: newTotal,
            items: { create: newItems },
          },
          include: {
            customer: true,
            items: { include: { service: { select: { id: true, name: true } } } },
            payments: { orderBy: { createdAt: "desc" } },
            statusHistory: { orderBy: { createdAt: "asc" } },
          },
        });
        return updatedOrder;
      });

      await auditLog({
        tenantId: session.tenantId,
        userId: session.userId,
        action: "ORDER_EDITED",
        entity: "Order",
        entityId: id,
        details: { code: order.code, oldTotal: order.totalAmount, newTotal },
      });

      return successResponse(updated);
    }

    // Simple field updates (notes, promisedAt)
    if (Object.keys(updateData).length > 0) {
      const updated = await prisma.order.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          items: { include: { service: { select: { id: true, name: true } } } },
          payments: { orderBy: { createdAt: "desc" } },
          statusHistory: { orderBy: { createdAt: "asc" } },
        },
      });

      await auditLog({
        tenantId: session.tenantId,
        userId: session.userId,
        action: "ORDER_EDITED",
        entity: "Order",
        entityId: id,
        details: { code: order.code, fields: Object.keys(updateData) },
      });

      return successResponse(updated);
    }

    return errorResponse("Aucune modification fournie", 400);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    // Only allow deleting if no payments have been made
    if (order.paidAmount > 0) {
      return errorResponse("Impossible de supprimer une commande avec des paiements. Annulez d'abord les paiements.", 400);
    }

    await prisma.order.delete({ where: { id } });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "ORDER_DELETED",
      entity: "Order",
      entityId: id,
      details: { code: order.code, totalAmount: order.totalAmount },
    });

    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
