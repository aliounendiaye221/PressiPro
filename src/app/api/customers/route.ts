import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { customerSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { parsePagination } from "@/lib/pagination";
import { buildPhoneLookupCandidates } from "@/lib/phone";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || "";
    const { page, limit } = parsePagination(searchParams, { maxLimit: 50 });

    const where = {
      tenantId: session.tenantId,
      ...(search
        ? {
            OR: [
              { phone: { contains: search, mode: "insensitive" as const } },
              { name: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rawCustomers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          orders: {
            where: { deletedAt: null },
            select: { totalAmount: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 6,
          },
          _count: {
            select: { orders: { where: { deletedAt: null } } },
          },
        },
        orderBy: { name: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customer.count({ where }),
    ]);

    const customers = rawCustomers.map((c) => {
      const spendingTrend = c.orders.map((o) => o.totalAmount).reverse();
      const totalSpent = c.orders.reduce((sum, o) => sum + o.totalAmount, 0);
      return {
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        address: c.address,
        notes: c.notes,
        createdAt: c.createdAt,
        totalOrders: c._count.orders,
        spendingTrend,
        totalSpent,
      };
    });

    return successResponse({ customers, total, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const body = await request.json();
    const data = customerSchema.parse(body);
    const phoneCandidates = buildPhoneLookupCandidates(data.phone);
    const phonesToCheck = phoneCandidates.length > 0 ? phoneCandidates : [data.phone];

    // Check duplicate phone for this tenant
    const existing = await prisma.customer.findFirst({
      where: {
        tenantId: session.tenantId,
        OR: phonesToCheck.map((phone) => ({ phone })),
      },
      select: { id: true },
    });
    if (existing) {
      return errorResponse("Un client avec ce numéro existe déjà", 409);
    }

    const customer = await prisma.customer.create({
      data: {
        tenantId: session.tenantId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
      },
    });

    return successResponse(customer, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
