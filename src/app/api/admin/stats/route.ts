import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";
import { handleApiError, successResponse } from "@/lib/api-utils";
import { SUBSCRIPTION_PLANS, type PlanKey } from "@/lib/subscription-plans";

export async function GET() {
  try {
    await requireSuperAdmin();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const activeOrderFilter = { deletedAt: null };

    const [
      totalTenants,
      totalUsers,
      activeUsers,
      totalOrders,
      totalCustomers,
      gmvCurrent,
      gmvPrevious,
      totalRevenue,
      recentPayments,
      tenants,
      paymentsByMethod,
      ordersByStatus,
      ordersThisMonth,
      ordersPrevMonth,
      tenantRevenuesMonth,
      tenantRevenuesAll,
      dailyPayments,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.customer.count(),
      prisma.payment.aggregate({
        where: { createdAt: { gte: startOfMonth }, order: activeOrderFilter },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
          order: activeOrderFilter,
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { order: activeOrderFilter },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: { order: activeOrderFilter },
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
          subscriptionExpiresAt: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              orders: { where: { deletedAt: null } },
              customers: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.payment.groupBy({
        by: ["method"],
        where: { createdAt: { gte: startOfMonth }, order: activeOrderFilter },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.order.groupBy({
        by: ["status"],
        where: { deletedAt: null },
        _count: true,
      }),
      prisma.order.count({
        where: { createdAt: { gte: startOfMonth }, deletedAt: null },
      }),
      prisma.order.count({
        where: {
          createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
          deletedAt: null,
        },
      }),
      prisma.payment.groupBy({
        by: ["tenantId"],
        where: { createdAt: { gte: startOfMonth }, order: activeOrderFilter },
        _sum: { amount: true },
      }),
      prisma.payment.groupBy({
        by: ["tenantId"],
        where: { order: activeOrderFilter },
        _sum: { amount: true },
      }),
      prisma.payment.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, order: activeOrderFilter },
        select: { amount: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const revenueByTenantMonth = Object.fromEntries(
      tenantRevenuesMonth.map((r) => [r.tenantId, r._sum.amount || 0])
    );
    const revenueByTenantAll = Object.fromEntries(
      tenantRevenuesAll.map((r) => [r.tenantId, r._sum.amount || 0])
    );

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

    const avgOrderValue =
      totalOrders > 0 ? Math.round((totalRevenue._sum.amount || 0) / totalOrders) : 0;

    const currentGMV = gmvCurrent._sum.amount || 0;
    const previousGMV = gmvPrevious._sum.amount || 0;
    const gmvGrowth =
      previousGMV > 0 ? Math.round(((currentGMV - previousGMV) / previousGMV) * 100) : 0;

    // Calcul du vrai MRR SaaS récurrent à partir des abonnements actifs non expirés
    const saasMrr = tenants.reduce((sum, t) => {
      if (!t.active) return sum;
      const planKey = (t.subscription || "FREE") as PlanKey;
      if (planKey === "FREE" || !SUBSCRIPTION_PLANS[planKey]) return sum;
      if (t.subscriptionExpiresAt && t.subscriptionExpiresAt.getTime() < now.getTime()) {
        return sum;
      }
      return sum + SUBSCRIPTION_PLANS[planKey].monthlyPrice;
    }, 0);

    const orderStatusMap = Object.fromEntries(
      ordersByStatus.map((s) => [s.status, s._count])
    );

    const saasRows = (await prisma.$queryRaw`
      SELECT COALESCE(SUM(amount), 0)::int as total
      FROM "SubscriptionPayment"
      WHERE status = 'SUCCESS'
    `) as Array<{ total: number }>;

    const saasPayments = (await prisma.$queryRaw`
      SELECT sp.id, sp.plan, sp.amount, sp."transactionId", sp."paymentMethod", sp.status, sp."createdAt", t.name as "tenantName"
      FROM "SubscriptionPayment" sp
      LEFT JOIN "Tenant" t ON sp."tenantId" = t.id
      ORDER BY sp."createdAt" DESC
      LIMIT 20
    `) as Array<{
      id: string;
      plan: string;
      amount: number;
      transactionId: string;
      paymentMethod: string | null;
      status: string;
      createdAt: Date;
      tenantName: string | null;
    }>;

    return successResponse({
      kpi: {
        totalTenants,
        totalUsers,
        activeUsers,
        totalOrders,
        totalCustomers,
        mrr: currentGMV,
        mrrGrowth: gmvGrowth,
        saasMrr,
        totalRevenue: totalRevenue._sum.amount || 0,
        saasTotalRevenue: saasRows?.[0]?.total || 0,
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
        subscriptionExpiresAt: t.subscriptionExpiresAt,
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
      subscriptionPayments: saasPayments || [],
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
