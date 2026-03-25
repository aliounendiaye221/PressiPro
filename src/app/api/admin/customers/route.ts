import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError, successResponse } from "@/lib/api-utils";
import { parsePagination } from "@/lib/pagination";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || "";
    const tenantId = searchParams.get("tenantId") || "";
    const { page, limit } = parsePagination(searchParams, { maxLimit: 100 });

    const where: Record<string, unknown> = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          tenant: { select: { id: true, name: true } },
          _count: { select: { orders: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    return successResponse({
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        tenantId: c.tenant.id,
        tenantName: c.tenant.name,
        orders: c._count.orders,
        createdAt: c.createdAt,
      })),
      total,
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
