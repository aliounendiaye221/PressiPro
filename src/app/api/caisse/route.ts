import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, successResponse } from "@/lib/api-utils";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const { searchParams } = new URL(request.url);

    const period = searchParams.get("period") || "all";
    const method = searchParams.get("method") || "ALL";
    const q = searchParams.get("q")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const dateFilter: Prisma.DateTimeFilter | undefined = (() => {
      if (period === "today") {
        return { gte: startOfToday };
      }
      if (period === "yesterday") {
        return { gte: startOfYesterday, lt: startOfToday };
      }
      if (period === "7d") {
        const d = new Date(startOfToday);
        d.setDate(d.getDate() - 7);
        return { gte: d };
      }
      if (period === "30d" || period === "month") {
        const d = new Date(now.getFullYear(), now.getMonth(), 1);
        return { gte: d };
      }
      return undefined;
    })();

    // Construct Prisma where clause
    const where: Prisma.PaymentWhereInput = {
      tenantId,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
      ...(method && method !== "ALL" ? { method: method as any } : {}),
    };

    if (q) {
      where.OR = [
        { order: { code: { contains: q, mode: "insensitive" } } },
        { order: { customer: { name: { contains: q, mode: "insensitive" } } } },
        { order: { customer: { phone: { contains: q } } } },
      ];
    }

    // Run parallel count, aggregations and paginated payments
    const [totalCount, amountAgg, methodGroups, payments] = await Promise.all([
      prisma.payment.count({ where }),

      prisma.payment.aggregate({
        where,
        _sum: { amount: true },
      }),

      prisma.payment.groupBy({
        by: ["method"],
        where,
        _sum: { amount: true },
        _count: true,
      }),

      prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              code: true,
              customer: {
                select: { id: true, name: true, phone: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    // Fetch user map for agent names
    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const userMap = new Map<string, string>(users.map((u) => [u.id, u.name]));

    const summaryByMethod = {
      CASH: 0,
      WAVE: 0,
      OM: 0,
      OTHER: 0,
    };

    methodGroups.forEach((g) => {
      if (g.method in summaryByMethod) {
        summaryByMethod[g.method as keyof typeof summaryByMethod] = g._sum.amount || 0;
      }
    });

    const formattedPayments = payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      createdAt: p.createdAt,
      orderId: p.order?.id || null,
      orderCode: p.order?.code || "—",
      customerId: p.order?.customer?.id || null,
      customerName: p.order?.customer?.name || "Client",
      customerPhone: p.order?.customer?.phone || "",
      agentName: p.createdBy ? userMap.get(p.createdBy) || "Agent" : "Système",
    }));

    return successResponse({
      payments: formattedPayments,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit) || 1,
      totalAmount: amountAgg._sum.amount || 0,
      summaryByMethod,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
