import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, successResponse } from "@/lib/api-utils";

function computeGrowth(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  return Math.round(((current - previous) / previous) * 100);
}

export async function GET() {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const now = new Date();

    // Date ranges
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const startOfYesterday = new Date(startOfDay);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const activeOrderFilter = { deletedAt: null };

    const [
      revenueDay,
      revenueWeek,
      revenueMonth,
      revenueYesterday,
      revenuePrevWeek,
      revenuePrevMonth,
      ordersThisMonthCount,
      topServicesGroups,
      expensesMonth,
      totalExpensesCount,
      unpaidOrders,
      lateOrders,
      ordersByStatus,
      paymentsByMethod,
      recentPayments,
      urgentOrders,
      todaysOrders,
      weeklyPayments,
      weeklyOrders,
      users,
    ] = await Promise.all([
      prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfDay }, order: activeOrderFilter },
        _sum: { amount: true },
      }),
      isAdmin
        ? prisma.payment.aggregate({
            where: { tenantId, createdAt: { gte: startOfWeek }, order: activeOrderFilter },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      isAdmin
        ? prisma.payment.aggregate({
            where: { tenantId, createdAt: { gte: startOfMonth }, order: activeOrderFilter },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),

      isAdmin
        ? prisma.payment.aggregate({
            where: {
              tenantId,
              createdAt: { gte: startOfYesterday, lt: startOfDay },
              order: activeOrderFilter,
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      isAdmin
        ? prisma.payment.aggregate({
            where: {
              tenantId,
              createdAt: { gte: startOfPrevWeek, lt: startOfWeek },
              order: activeOrderFilter,
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),
      isAdmin
        ? prisma.payment.aggregate({
            where: {
              tenantId,
              createdAt: { gte: startOfPrevMonth, lt: startOfMonth },
              order: activeOrderFilter,
            },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: 0 } }),

      prisma.order.count({
        where: { tenantId, createdAt: { gte: startOfMonth }, deletedAt: null },
      }),

      // Agrégation SQL groupBy au lieu de charger tous les OrderItem du mois en mémoire
      isAdmin
        ? prisma.orderItem.groupBy({
            by: ["name"],
            where: {
              order: {
                tenantId,
                createdAt: { gte: startOfMonth },
                deletedAt: null,
              },
            },
            _sum: { quantity: true, total: true },
          })
        : Promise.resolve([]),

      isAdmin
        ? prisma.expense.aggregate({
            where: { tenantId, date: { gte: startOfMonth } },
            _sum: { amount: true },
            _count: true,
          })
        : Promise.resolve({ _sum: { amount: 0 }, _count: 0 }),

      isAdmin ? prisma.expense.count({ where: { tenantId } }) : Promise.resolve(0),

      // Inclure toutes les commandes non soldées, y compris celles livrées à crédit (LIVRE)
      prisma.order.findMany({
        where: {
          tenantId,
          deletedAt: null,
          paidAmount: { lt: prisma.order.fields.totalAmount },
        },
        select: { totalAmount: true, paidAmount: true },
      }),

      prisma.order.count({
        where: {
          tenantId,
          promisedAt: { lt: now },
          status: { notIn: ["LIVRE"] },
          deletedAt: null,
        },
      }),

      prisma.order.groupBy({
        by: ["status"],
        where: { tenantId, deletedAt: null },
        _count: true,
      }),

      prisma.payment.groupBy({
        by: ["method"],
        where: { tenantId, createdAt: { gte: startOfDay }, order: activeOrderFilter },
        _sum: { amount: true },
        _count: true,
      }),

      prisma.payment.findMany({
        where: {
          tenantId,
          order: activeOrderFilter,
          ...(isAdmin ? {} : { createdAt: { gte: startOfDay } }),
        },
        include: {
          order: { select: { id: true, code: true, customer: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: isAdmin ? 50 : 20,
      }),

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

      isAdmin
        ? prisma.payment.findMany({
            where: { tenantId, createdAt: { gte: startOfWeek }, order: activeOrderFilter },
            select: { amount: true, createdAt: true },
          })
        : Promise.resolve([]),

      prisma.order.findMany({
        where: { tenantId, createdAt: { gte: startOfWeek }, deletedAt: null },
        select: { createdAt: true },
      }),

      prisma.user.findMany({
        where: { tenantId },
        select: { id: true, name: true },
      }),
    ]);

    const weeklyDailyRevenue = [0, 0, 0, 0, 0, 0, 0];
    if (isAdmin) {
      for (const p of weeklyPayments) {
        const pDate = new Date(p.createdAt);
        const dayIdx = (pDate.getDay() + 6) % 7;
        if (dayIdx >= 0 && dayIdx < 7) {
          weeklyDailyRevenue[dayIdx] += p.amount;
        }
      }
    }

    const weeklyDailyOrders = [0, 0, 0, 0, 0, 0, 0];
    for (const o of weeklyOrders || []) {
      const oDate = new Date(o.createdAt);
      const dayIdx = (oDate.getDay() + 6) % 7;
      if (dayIdx >= 0 && dayIdx < 7) {
        weeklyDailyOrders[dayIdx] += 1;
      }
    }

    const currentDayRevenue = revenueDay._sum.amount || 0;
    const currentWeekRevenue = isAdmin ? revenueWeek._sum.amount || 0 : 0;
    const monthRevenue = isAdmin ? revenueMonth._sum.amount || 0 : 0;

    const yesterdayRevenue = revenueYesterday._sum.amount || 0;
    const prevWeekRevenue = revenuePrevWeek._sum.amount || 0;
    const prevMonthRevenue = revenuePrevMonth._sum.amount || 0;

    const growth = isAdmin
      ? {
          day: computeGrowth(currentDayRevenue, yesterdayRevenue),
          week: computeGrowth(currentWeekRevenue, prevWeekRevenue),
          month: computeGrowth(monthRevenue, prevMonthRevenue),
        }
      : { day: null, week: null, month: null };

    const totalItemsCount = topServicesGroups.reduce(
      (acc, g) => acc + (g._sum.quantity || 0),
      0
    );
    const topServices = isAdmin
      ? topServicesGroups
          .map((g) => {
            const quantity = g._sum.quantity || 0;
            const total = g._sum.total || 0;
            return {
              name: g.name,
              quantity,
              total,
              percentage:
                totalItemsCount > 0 ? Math.round((quantity / totalItemsCount) * 100) : 0,
            };
          })
          .sort((a, b) => b.total - a.total)
          .slice(0, 5)
      : [];

    const averageOrderValue =
      isAdmin && ordersThisMonthCount > 0
        ? Math.round(monthRevenue / ordersThisMonthCount)
        : 0;

    const totalUnpaid = unpaidOrders.reduce(
      (sum, o) => sum + Math.max(0, o.totalAmount - o.paidAmount),
      0
    );

    const userMap = new Map<string, string>(users.map((u) => [u.id, u.name]));

    const monthExpenses = expensesMonth._sum.amount || 0;
    const netProfit = monthRevenue - monthExpenses;
    const margin = monthRevenue > 0 ? Math.round((netProfit / monthRevenue) * 100) : 0;

    return successResponse({
      revenue: {
        day: currentDayRevenue,
        week: currentWeekRevenue,
        month: monthRevenue,
      },
      growth,
      weeklyDailyRevenue,
      weeklyDailyOrders,
      averageOrderValue,
      monthOrdersCount: ordersThisMonthCount,
      topServices,
      monthlyFinancials: isAdmin
        ? {
            revenue: monthRevenue,
            expenses: monthExpenses,
            netProfit,
            margin,
            isProfit: netProfit >= 0,
            expenseCount: expensesMonth._count || 0,
          }
        : null,
      hasExpenses: isAdmin ? totalExpensesCount > 0 : false,
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
        orderId: p.order.id,
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
