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
    const now = new Date();

    // Date ranges
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = (now.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    // Prior comparative periods
    const startOfYesterday = new Date(startOfDay);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    const startOfPrevWeek = new Date(startOfWeek);
    startOfPrevWeek.setDate(startOfPrevWeek.getDate() - 7);

    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Execute queries in parallel for high performance
    const [
      revenueDay,
      revenueWeek,
      revenueMonth,
      revenueYesterday,
      revenuePrevWeek,
      revenuePrevMonth,
      ordersThisMonthCount,
      monthOrderItems,
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
    ] = await Promise.all([
      // Current revenues
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

      // Prior comparative revenues
      prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfYesterday, lt: startOfDay } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfPrevWeek, lt: startOfWeek } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfPrevMonth, lt: startOfMonth } },
        _sum: { amount: true },
      }),

      // Total orders count this month for average order value calculation
      prisma.order.count({
        where: { tenantId, createdAt: { gte: startOfMonth }, deletedAt: null },
      }),

      // Top services query for the month
      prisma.orderItem.findMany({
        where: {
          order: {
            tenantId,
            createdAt: { gte: startOfMonth },
            deletedAt: null,
          },
        },
        select: {
          name: true,
          quantity: true,
          total: true,
        },
      }),

      // Current month expenses
      prisma.expense.aggregate({
        where: { tenantId, date: { gte: startOfMonth } },
        _sum: { amount: true },
        _count: true,
      }),

      // Has any expense in tenant history
      prisma.expense.count({
        where: { tenantId },
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
          order: { select: { id: true, code: true, customer: { select: { name: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
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

      // Weekly Payments for real day-by-day revenue breakdown (Audit item 2)
      prisma.payment.findMany({
        where: { tenantId, createdAt: { gte: startOfWeek } },
        select: { amount: true, createdAt: true },
      }),

      // Weekly Orders for real day-by-day volume breakdown
      prisma.order.findMany({
        where: { tenantId, createdAt: { gte: startOfWeek }, deletedAt: null },
        select: { createdAt: true },
      }),
    ]);

    // Calculate real revenue & orders per day of the week (Monday=0 to Sunday=6)
    const weeklyDailyRevenue = [0, 0, 0, 0, 0, 0, 0];
    for (const p of weeklyPayments) {
      const pDate = new Date(p.createdAt);
      const dayIdx = (pDate.getDay() + 6) % 7;
      if (dayIdx >= 0 && dayIdx < 7) {
        weeklyDailyRevenue[dayIdx] += p.amount;
      }
    }

    const weeklyDailyOrders = [0, 0, 0, 0, 0, 0, 0];
    for (const o of (weeklyOrders || [])) {
      const oDate = new Date(o.createdAt);
      const dayIdx = (oDate.getDay() + 6) % 7;
      if (dayIdx >= 0 && dayIdx < 7) {
        weeklyDailyOrders[dayIdx] += 1;
      }
    }

    const currentDayRevenue = revenueDay._sum.amount || 0;
    const currentWeekRevenue = revenueWeek._sum.amount || 0;
    const monthRevenue = revenueMonth._sum.amount || 0;

    const yesterdayRevenue = revenueYesterday._sum.amount || 0;
    const prevWeekRevenue = revenuePrevWeek._sum.amount || 0;
    const prevMonthRevenue = revenuePrevMonth._sum.amount || 0;

    // Growth indicators (% vs yesterday, % vs previous week, % vs previous month)
    const growth = {
      day: computeGrowth(currentDayRevenue, yesterdayRevenue),
      week: computeGrowth(currentWeekRevenue, prevWeekRevenue),
      month: computeGrowth(monthRevenue, prevMonthRevenue),
    };

    // Calculate Top 5 Services of the Month
    const serviceMap = new Map<string, { quantity: number; total: number }>();
    let totalItemsCount = 0;
    for (const item of monthOrderItems) {
      const existing = serviceMap.get(item.name) || { quantity: 0, total: 0 };
      existing.quantity += item.quantity;
      existing.total += item.total;
      serviceMap.set(item.name, existing);
      totalItemsCount += item.quantity;
    }

    const topServices = Array.from(serviceMap.entries())
      .map(([name, stat]) => ({
        name,
        quantity: stat.quantity,
        total: stat.total,
        percentage: totalItemsCount > 0 ? Math.round((stat.quantity / totalItemsCount) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Panier Moyen (Average Order Value)
    const averageOrderValue = ordersThisMonthCount > 0
      ? Math.round(monthRevenue / ordersThisMonthCount)
      : 0;

    const totalUnpaid = unpaidOrders.reduce(
      (sum: number, o: { totalAmount: number; paidAmount: number }) => sum + (o.totalAmount - o.paidAmount),
      0
    );

    const users = await prisma.user.findMany({
      where: { tenantId },
      select: { id: true, name: true },
    });
    const userMap = new Map<string, string>(users.map((u: { id: string; name: string }) => [u.id, u.name]));

    const monthExpenses = expensesMonth._sum.amount || 0;
    const netProfit = monthRevenue - monthExpenses;
    const margin = monthRevenue > 0 ? Math.round((netProfit / monthRevenue) * 100) : 0;

    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

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
        ordersByStatus.map((s: { status: string; _count: number }) => [s.status, s._count])
      ),
      paymentsByMethod: paymentsByMethod.map((p: { method: string; _sum: { amount: number | null }; _count: number }) => ({
        method: p.method,
        total: p._sum.amount || 0,
        count: p._count,
      })),
      recentPayments: recentPayments.map((p: any) => ({
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
