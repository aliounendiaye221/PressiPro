import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";
import { updateOrderSchema } from "@/lib/validators";
import { computeOrderItems, computeFinalTotal } from "@/lib/order-utils";
import type { Prisma } from "@prisma/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId, deletedAt: null },
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

    const users = await prisma.user.findMany({
      where: { tenantId: session.tenantId },
      select: { id: true, name: true },
    });
    const userMap = new Map<string, string>(users.map((u) => [u.id, u.name]));

    const enrichedPayments = order.payments.map((p) => ({
      ...p,
      agentName: p.createdBy ? userMap.get(p.createdBy) || "Agent" : "Système",
    }));

    return successResponse({
      ...order,
      payments: enrichedPayments,
    });
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
    const data = updateOrderSchema.parse(body);

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId, deletedAt: null },
      include: { items: true },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    if (order.status === "LIVRE") {
      return errorResponse("Impossible de modifier une commande livrée", 400);
    }

    const updateData: Prisma.OrderUpdateInput = {};

    if (data.notes !== undefined) {
      updateData.notes = data.notes || null;
    }

    if (data.promisedAt !== undefined) {
      updateData.promisedAt = data.promisedAt ? new Date(data.promisedAt) : null;
    }

    // Cas 1 : Mise à jour des articles (avec ou sans remise)
    if (data.items && data.items.length > 0) {
      const uniqueServiceIds = [...new Set(data.items.map((i) => i.serviceId))];
      const services = await prisma.service.findMany({
        where: { id: { in: uniqueServiceIds }, tenantId: session.tenantId, active: true },
      });
      if (services.length !== uniqueServiceIds.length) {
        return errorResponse("Un ou plusieurs services sont invalides ou désactivés", 400);
      }

      const serviceMap = new Map<string, (typeof services)[0]>(
        services.map((s) => [s.id, s])
      );

      let newItems;
      let newItemsTotal = 0;
      try {
        const computed = computeOrderItems(data.items, serviceMap);
        newItems = computed.items;
        newItemsTotal = computed.itemsTotal;
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("VALIDATION:")) {
          return errorResponse(err.message.replace("VALIDATION:", ""), 400);
        }
        throw err;
      }

      const rawDiscount = data.discountAmount ?? order.discountAmount;
      const { totalAmount: finalTotalAmount, cappedDiscount: discountAmount } =
        computeFinalTotal(newItemsTotal, rawDiscount);

      if (finalTotalAmount < order.paidAmount) {
        return errorResponse(
          `Le nouveau total (${finalTotalAmount} FCFA) ne peut pas être inférieur au montant déjà encaissé (${order.paidAmount} FCFA).`,
          400
        );
      }

      const updated = await prisma.$transaction(async (tx) => {
        const p = tx as typeof prisma;
        await p.orderItem.deleteMany({ where: { orderId: id } });

        return p.order.update({
          where: { id },
          data: {
            ...updateData,
            discountAmount,
            discountReason:
              data.discountReason !== undefined
                ? data.discountReason || null
                : order.discountReason,
            totalAmount: finalTotalAmount,
            items: { create: newItems },
          },
          include: {
            customer: true,
            items: { include: { service: { select: { id: true, name: true } } } },
            payments: { orderBy: { createdAt: "desc" } },
            statusHistory: { orderBy: { createdAt: "asc" } },
          },
        });
      });

      await auditLog({
        tenantId: session.tenantId,
        userId: session.userId,
        action: "ORDER_EDITED",
        entity: "Order",
        entityId: id,
        details: { code: order.code, oldTotal: order.totalAmount, newTotal: finalTotalAmount },
      });

      return successResponse(updated);
    }

    // Cas 2 : Mise à jour de la remise seule (sans renvoyer `items`)
    if (data.discountAmount !== undefined || data.discountReason !== undefined) {
      const existingItemsSubtotal = order.items.reduce((sum, item) => sum + item.total, 0);
      const rawDiscount = data.discountAmount ?? order.discountAmount;
      const { totalAmount: finalTotalAmount, cappedDiscount: discountAmount } =
        computeFinalTotal(existingItemsSubtotal, rawDiscount);

      if (finalTotalAmount < order.paidAmount) {
        return errorResponse(
          `Le nouveau total (${finalTotalAmount} FCFA) ne peut pas être inférieur au montant déjà encaissé (${order.paidAmount} FCFA).`,
          400
        );
      }

      updateData.discountAmount = discountAmount;
      updateData.totalAmount = finalTotalAmount;
      if (data.discountReason !== undefined) {
        updateData.discountReason = data.discountReason || null;
      }
    }

    // Cas 3 : Mise à jour des champs simples (notes, promisedAt, et/ou remise seule)
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
      where: { id, tenantId: session.tenantId, deletedAt: null },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    if (order.paidAmount > 0 || order.payments.length > 0) {
      return errorResponse(
        "Impossible de supprimer une commande ayant des paiements. Annulez d'abord les paiements.",
        400
      );
    }

    await prisma.order.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "ORDER_DELETED",
      entity: "Order",
      entityId: id,
      details: {
        code: order.code,
        totalAmount: order.totalAmount,
        snapshot: {
          id: order.id,
          code: order.code,
          customerId: order.customerId,
          status: order.status,
          totalAmount: order.totalAmount,
          discountAmount: order.discountAmount,
          discountReason: order.discountReason,
          paidAmount: order.paidAmount,
          notes: order.notes,
          promisedAt: order.promisedAt?.toISOString() || null,
          createdAt: order.createdAt.toISOString(),
          updatedAt: order.updatedAt.toISOString(),
          items: order.items.map((i) => ({
            id: i.id,
            serviceId: i.serviceId,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            weight: i.weight,
            pricingType: i.pricingType,
            total: i.total,
          })),
          payments: order.payments.map((p) => ({
            id: p.id,
            amount: p.amount,
            method: p.method,
            note: p.note,
            createdBy: p.createdBy,
            createdAt: p.createdAt.toISOString(),
          })),
        },
      },
    });

    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
