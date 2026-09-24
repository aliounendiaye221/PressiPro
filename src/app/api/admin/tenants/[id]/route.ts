import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { z } from "zod";


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

    const updateAdminTenantSchema = z.object({
      active: z.boolean().optional(),
      subscription: z.enum(["FREE", "BASIC", "PRO", "ENTERPRISE"]).optional(),
      name: z.string().min(2).max(100).optional(),
      phone: z.string().max(30).optional().or(z.literal("")),
      address: z.string().max(200).optional().or(z.literal("")),
    });

    const data = updateAdminTenantSchema.safeParse(body);
    if (!data.success) {
      return errorResponse(
        data.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", "),
        400
      );
    }

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return errorResponse("Pressing introuvable", 404);

    const updateData: Record<string, unknown> = {};

    if (data.data.active !== undefined) {
      updateData.active = data.data.active;
    }
    if (data.data.subscription !== undefined) {
      updateData.subscription = data.data.subscription;
      if (data.data.subscription !== tenant.subscription) {
        updateData.subscribedAt = new Date();
      }
    }
    if (data.data.name !== undefined) {
      updateData.name = data.data.name.trim();
    }
    if (data.data.phone !== undefined) {
      updateData.phone = data.data.phone.trim() || null;
    }
    if (data.data.address !== undefined) {
      updateData.address = data.data.address.trim() || null;
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
      const p = tx as typeof prisma;
      await p.auditLog.deleteMany({ where: { tenantId: id } });
      await p.payment.deleteMany({ where: { tenantId: id } });
      // Order sub-items via cascading deletes on order
      const orders = await p.order.findMany({ where: { tenantId: id }, select: { id: true } });
      const orderIds = orders.map((o: { id: string }) => o.id);
      if (orderIds.length > 0) {
        await p.orderStatusHistory.deleteMany({ where: { orderId: { in: orderIds } } });
        await p.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      }
      await p.order.deleteMany({ where: { tenantId: id } });
      await p.customer.deleteMany({ where: { tenantId: id } });
      await p.service.deleteMany({ where: { tenantId: id } });
      await p.user.deleteMany({ where: { tenantId: id } });
      await p.tenant.delete({ where: { id } });
    });

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
