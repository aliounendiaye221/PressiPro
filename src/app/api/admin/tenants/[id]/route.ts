import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";
import { auditLog } from "@/lib/audit";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { NextRequest } from "next/server";
import { z } from "zod";

function sanitizeAdminTenant<T extends Record<string, unknown>>(tenant: T) {
  const {
    cinetpayApiKey,
    cinetpaySecretKey,
    ...rest
  } = tenant as T & {
    cinetpayApiKey?: string | null;
    cinetpaySecretKey?: string | null;
  };
  return {
    ...rest,
    hasCinetpayApiKey: Boolean(cinetpayApiKey && cinetpayApiKey.trim().length > 0),
    hasCinetpaySecretKey: Boolean(cinetpaySecretKey && cinetpaySecretKey.trim().length > 0),
  };
}

// GET — détails d'un tenant
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();
    const { id } = await params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            orders: true,
            customers: true,
            services: true,
            payments: true,
            expenses: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            active: true,
            createdAt: true,
          },
        },
      },
    });

    if (!tenant) return errorResponse("Pressing introuvable", 404);

    return successResponse(sanitizeAdminTenant(tenant));
  } catch (error) {
    return handleApiError(error);
  }
}

// PUT — modifier un tenant (active, subscription, subscriptionExpiresAt, name, phone, address)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperAdmin();
    const { id } = await params;
    const body = await req.json();

    const updateAdminTenantSchema = z.object({
      active: z.boolean().optional(),
      subscription: z.enum(["FREE", "BASIC", "PRO", "ENTERPRISE"]).optional(),
      subscriptionExpiresAt: z
        .string()
        .refine((v) => !Number.isNaN(new Date(v).getTime()), "Date d'expiration invalide")
        .nullable()
        .optional(),
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

    if (data.data.active === false && session.tenantId === id) {
      return errorResponse(
        "Impossible de désactiver le pressing rattaché à votre propre session Super-Admin",
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
        updateData.subscribedAt = data.data.subscription === "FREE" ? null : new Date();
      }
      if (data.data.subscription === "FREE" && data.data.subscriptionExpiresAt === undefined) {
        updateData.subscriptionExpiresAt = null;
      } else if (
        data.data.subscription !== "FREE" &&
        data.data.subscriptionExpiresAt === undefined &&
        (!tenant.subscriptionExpiresAt || tenant.subscriptionExpiresAt.getTime() < Date.now())
      ) {
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + 30);
        updateData.subscriptionExpiresAt = defaultExpiry;
      }
    }
    if (data.data.subscriptionExpiresAt !== undefined) {
      updateData.subscriptionExpiresAt = data.data.subscriptionExpiresAt
        ? new Date(data.data.subscriptionExpiresAt)
        : null;
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

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "ADMIN_TENANT_UPDATED",
      entity: "Tenant",
      entityId: id,
      details: {
        targetTenantName: updated.name,
        changes: Object.keys(updateData),
      },
    });

    return successResponse(sanitizeAdminTenant(updated));
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE — supprimer un pressing et toutes ses données
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSuperAdmin();
    const { id } = await params;

    if (session.tenantId === id) {
      return errorResponse(
        "Impossible de supprimer le pressing rattaché à votre propre compte Super-Admin",
        400
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { _count: { select: { orders: true } } },
    });

    if (!tenant) return errorResponse("Pressing introuvable", 404);

    const superAdminCount = await prisma.user.count({
      where: { tenantId: id, role: "SUPER_ADMIN" },
    });
    if (superAdminCount > 0) {
      return errorResponse(
        "Ce pressing contient un compte Super-Admin et ne peut pas être supprimé",
        400
      );
    }

    // Supprimer dans l'ordre strict des clés étrangères (incluant Expense et SubscriptionPayment)
    await prisma.$transaction(async (tx) => {
      const p = tx as typeof prisma;
      await p.auditLog.deleteMany({ where: { tenantId: id } });
      await p.expense.deleteMany({ where: { tenantId: id } });
      await p.subscriptionPayment.deleteMany({ where: { tenantId: id } });
      await p.payment.deleteMany({ where: { tenantId: id } });

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

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "ADMIN_TENANT_DELETED",
      entity: "Tenant",
      entityId: id,
      details: {
        deletedTenantName: tenant.name,
        deletedOrdersCount: tenant._count.orders,
      },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
