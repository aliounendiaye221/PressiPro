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

    const [
      totalTenants,
      totalUsers,
      activeUsers,
      totalOrders,
      totalCustomers,
      mrrCurrent,
      mrrPrevious,
      recentPayments,
      tenants,
      paymentsByMethod,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.order.count(),
      prisma.customer.count(),
      // MRR: sum of all payments this month
      prisma.payment.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
      // Previous month revenue for comparison
      prisma.payment.aggregate({
        where: { createdAt: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
        _sum: { amount: true },
      }),
      // Recent payments across all tenants
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
      // Per-tenant stats
      prisma.tenant.findMany({
        select: {
          id: true,
          name: true,
          phone: true,
          createdAt: true,
          _count: {
            select: { users: true, orders: true, customers: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      // Payments by method this month
      prisma.payment.groupBy({
        by: ["method"],
        where: { createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Per-tenant revenue this month
    const tenantRevenues = await prisma.payment.groupBy({
      by: ["tenantId"],
      where: { createdAt: { gte: startOfMonth } },
      _sum: { amount: true },
    });
    const revenueByTenant = Object.fromEntries(
      tenantRevenues.map((r) => [r.tenantId, r._sum.amount || 0])
    );

    const currentMRR = mrrCurrent._sum.amount || 0;
    const previousMRR = mrrPrevious._sum.amount || 0;
    const mrrGrowth = previousMRR > 0
      ? Math.round(((currentMRR - previousMRR) / previousMRR) * 100)
      : 0;

    return successResponse({
      kpi: {
        totalTenants,
        totalUsers,
        activeUsers,
        totalOrders,
        totalCustomers,
        mrr: currentMRR,
        mrrGrowth,
      },
      tenants: tenants.map((t) => ({
        id: t.id,
        name: t.name,
        phone: t.phone,
        createdAt: t.createdAt,
        users: t._count.users,
        orders: t._count.orders,
        customers: t._count.customers,
        revenue: revenueByTenant[t.id] || 0,
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
