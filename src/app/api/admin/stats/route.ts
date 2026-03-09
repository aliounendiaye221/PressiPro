import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError, successResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    await requireSuperAdmin();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Last 30 days for daily revenue chart
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalTenants,
      totalUsers,
      activeUsers,
      totalOrders,
      totalCustomers,
      mrrCurrent,
      mrrPrevious,
      totalRevenue,
      recentPayments,
      tenants,
      paymentsByMethod,
      ordersByStatus,
      ordersThisMonth,
      ordersPrevMonth,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.order.count(),
      prisma.customer.count(),
      prisma.payment.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({ _sum: { amount: true } }),
      prisma.payment.findMany({
        include: {
          order: {
            select: {
              code: true,
              customer: { select: { name: true } },
            },
          },
          tenant: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          active: true,
          subscription: true,
          createdAt: true,
          _count: {
            select: { users: true, orders: true, customers: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: { createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ["status"],
        _count: true,
      }),
      prisma.order.count({ where: { createdAt: { gte: startOfMonth } } }),
      prisma.order.count({ where: { createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } } }),
    ]);

    // Per-tenant revenue this month + all-time
    const [tenantRevenuesMonth, tenantRevenuesAll] = await Promise.all([
      prisma.payment.groupBy({
        by: ["tenantId"],
        where: { createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ["tenantId"],
        _sum: { amount: true },
      }),
    ]);

    const revenueByTenantMonth = Object.fromEntries(
      tenantRevenuesMonth.map((r) => [r.tenantId, r._sum.amount || 0])
    );
    const revenueByTenantAll = Object.fromEntries(
      tenantRevenuesAll.map((r) => [r.tenantId, r._sum.amount || 0])
    );

    // Daily revenue for the last 30 days
    const dailyPayments = await prisma.payment.findMany({
      where: { createdAt: { gte: thirtyDaysAgo } },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    const dailyRevenueMap: Record<string, number> = {};
    for (const p of dailyPayments) {
      const day = p.createdAt.toISOString().slice(0, 10);
      dailyRevenueMap[day] = (dailyRevenueMap[day] || 0) + p.amount;
    }

    const dailyRevenue: { date: string; amount: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyRevenue.push({ date: key, amount: dailyRevenueMap[key] || 0 });
    }

    // Average order value
    const avgOrderValue = totalOrders > 0
      ? Math.round((totalRevenue._sum.amount || 0) / totalOrders)
      : 0;

    const currentMRR = mrrCurrent._sum.amount || 0;
    const previousMRR = mrrPrevious._sum.amount || 0;
    const mrrGrowth = previousMRR > 0
      ? Math.round(((currentMRR - previousMRR) / previousMRR) * 100)
      : 0;

    const orderStatusMap = Object.fromEntries(
      ordersByStatus.map((s) => [s.status, s._count])
    );

    return successResponse({
      kpi: {
        totalTenants,
        totalUsers,
        activeUsers,
        totalOrders,
        totalCustomers,
        mrr: currentMRR,
        mrrGrowth,
        totalRevenue: totalRevenue._sum.amount || 0,
        avgOrderValue,
        ordersThisMonth,
        ordersPrevMonth,
      },
      ordersByStatus: {
        RECU: orderStatusMap["RECU"] || 0,
        TRAITEMENT: orderStatusMap["TRAITEMENT"] || 0,
        PRET: orderStatusMap["PRET"] || 0,
        LIVRE: orderStatusMap["LIVRE"] || 0,
      },
      dailyRevenue,
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        phone: t.phone,
        active: t.active,
        subscription: t.subscription,
        createdAt: t.createdAt,
        users: t._count.users,
        orders: t._count.orders,
        customers: t._count.customers,
        revenue: revenueByTenantMonth[t.id] || 0,
        totalRevenue: revenueByTenantAll[t.id] || 0,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        orderCode: p.order.code,
        customerName: p.order.customer.name,
        tenantName: p.tenant.name,
        createdAt: p.createdAt,
      })),
      paymentsByMethod: paymentsByMethod.map((p) => ({
        method: p.method,
        total: p._sum.amount || 0,
        count: p._count,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
