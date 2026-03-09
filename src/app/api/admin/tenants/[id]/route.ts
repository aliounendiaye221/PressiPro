import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";

// GET — détails d'un tenant
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: { select: { users: true, orders: true, customers: true, services: true, payments: true } },
        users: { select: { id: true, name: true, email: true, role: true, active: true, createdAt: true } },
      },
    });

    if (!tenant) return errorResponse("Pressing introuvable", 404);

    return successResponse(tenant);
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT — modifier un tenant (active, subscription, name, phone, address)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;
    const body = await req.json();

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return errorResponse("Pressing introuvable", 404);

    const updateData: Record<string, unknown> = {};

    if (typeof body.active === "boolean") {
      updateData.active = body.active;
    }
    if (typeof body.subscription === "string") {
      const validSubs = ["FREE", "BASIC", "PRO", "ENTERPRISE"];
      if (!validSubs.includes(body.subscription)) {
        return errorResponse("Abonnement invalide", 400);
      }
      updateData.subscription = body.subscription;
      if (body.subscription !== tenant.subscription) {
        updateData.subscribedAt = new Date();
      }
    }
    if (typeof body.name === "string" && body.name.trim()) {
      updateData.name = body.name.trim();
    }
    if (typeof body.phone === "string") {
      updateData.phone = body.phone.trim() || null;
    }
    if (typeof body.address === "string") {
      updateData.address = body.address.trim() || null;
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: updateData,
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE — supprimer un pressing et toutes ses données
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!tenant) return errorResponse("Pressing introuvable", 404);

    // Supprimer en cascade: audit logs, payments, order items, order status history, orders, customers, services, users, tenant
    await prisma.$transaction(async (tx) => {
      await tx.auditLog.deleteMany({ where: { tenantId: id } });
      await tx.payment.deleteMany({ where: { tenantId: id } });
      // Order sub-items via cascading deletes on order
      const orders = await tx.order.findMany({ where: { tenantId: id }, select: { id: true } });
      const orderIds = orders.map((o) => o.id);
      if (orderIds.length > 0) {
        await tx.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
        await tx.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      }
      await tx.order.deleteMany({ where: { tenantId: id } });
      await tx.customer.deleteMany({ where: { tenantId: id } });
      await tx.service.deleteMany({ where: { tenantId: id } });
      await tx.user.deleteMany({ where: { tenantId: id } });
      await tx.tenant.delete({ where: { id } });
    });

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
