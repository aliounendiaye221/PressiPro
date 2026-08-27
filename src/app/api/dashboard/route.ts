import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, successResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const now = new Date();

    // Date ranges
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Execute ALL queries in parallel for maximum performance
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [
      revenueDay,
      revenueWeek,
      revenueMonth,
      unpaidOrders,
      lateOrders,
      ordersByStatus,
      paymentsByMethod,
      recentPayments,
      urgentOrders,
      todaysOrders,
    ] = await Promise.all([
      // Revenue calculations
      prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfDay } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfWeek } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),

      // Unpaid totals
      prisma.order.findMany({
        where: {
          tenantId,
          status: { not: "LIVRE" },
          deletedAt: null,
        },
        select: { totalAmount: true, paidAmount: true },
      }),

      // Late orders count
      prisma.order.count({
        where: {
          tenantId,
          promisedAt: { lt: now },
          status: { notIn: ["LIVRE"] },
          deletedAt: null,
        },
      }),

      // Orders by status
      prisma.order.groupBy({
        by: ["status"],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),

      // Today's payments by method
      prisma.payment.groupBy({
        by: ["method"],
        where: { tenantId, createdAt: { gte: startOfDay } },
        _sum: { amount: true },
        _count: true,
      }),

      // Recent payments
      prisma.payment.findMany({
        where: { tenantId },
        include: {
          order: { select: { code: true, customer: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),

      // Urgent Orders (Late)
      prisma.order.findMany({
        where: {
          tenantId,
          promisedAt: { lt: now },
          status: { notIn: ["PRET", "LIVRE"] },
          deletedAt: null,
        },
        select: {
          id: true,
          code: true,
          promisedAt: true,
          status: true,
          customer: { select: { name: true, phone: true } },
        },
        take: 5,
        orderBy: { promisedAt: "asc" },
      }),

      // Today's Orders (Deliverable today)
      prisma.order.findMany({
        where: {
          tenantId,
          promisedAt: { gte: startOfDay, lt: endOfDay },
          status: { not: "LIVRE" },
          deletedAt: null,
        },
        select: {
          id: true,
          code: true,
          promisedAt: true,
          status: true,
          customer: { select: { name: true, phone: true } },
        },
        take: 5,
        orderBy: { promisedAt: "asc" },
      }),
    ]);

    const totalUnpaid = unpaidOrders.reduce(
      (sum, o) => sum + (o.totalAmount - o.paidAmount),
      0
    );

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u.name]));

    return successResponse({
      revenue: {
        day: revenueDay._sum.amount || 0,
        week: revenueWeek._sum.amount || 0,
        month: revenueMonth._sum.amount || 0,
      },
      totalUnpaid,
      lateOrders,
      ordersByStatus: Object.fromEntries(
        ordersByStatus.map((s) => [s.status, s._count])
      ),
      paymentsByMethod: paymentsByMethod.map((p) => ({
        method: p.method,
        total: p._sum.amount || 0,
        count: p._count,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        orderCode: p.order.code,
        customerName: p.order.customer.name,
        agentName: p.createdBy ? userMap.get(p.createdBy) || "Agent" : "Système",
        createdAt: p.createdAt,
      })),
      urgentOrders,
      todaysOrders,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
