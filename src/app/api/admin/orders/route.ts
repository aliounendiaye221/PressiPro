import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError, successResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const tenantId = searchParams.get("tenantId") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (status && ["RECU", "TRAITEMENT", "PRET", "LIVRE"].includes(status)) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          tenant: { select: { id: true, name: true } },
          items: { select: { name: true, quantity: true, unitPrice: true, total: true } },
          payments: { select: { amount: true, method: true, createdAt: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return successResponse({
      orders: orders.map((o) => ({
        id: o.id,
        code: o.code,
        status: o.status,
        totalAmount: o.totalAmount,
        paidAmount: o.paidAmount,
        customerName: o.customer.name,
        customerPhone: o.customer.phone,
        tenantId: o.tenant.id,
        tenantName: o.tenant.name,
        items: o.items,
        payments: o.payments,
        createdAt: o.createdAt,
        promisedAt: o.promisedAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
