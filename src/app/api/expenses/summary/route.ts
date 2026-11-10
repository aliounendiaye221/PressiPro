import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, successResponse } from "@/lib/api-utils";

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function formatMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const tenantId = session.tenantId;

    const now = new Date();
    const currentMonthKey = formatMonthKey(now);
    const selectedMonthKey = searchParams.get("month") || currentMonthKey;

    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth(); // 0-indexed

    if (/^\d{4}-\d{2}$/.test(selectedMonthKey)) {
      const [y, m] = selectedMonthKey.split("-").map(Number);
      if (m >= 1 && m <= 12) {
        targetYear = y;
        targetMonth = m - 1;
      }
    }

    const startOfSelectedMonth = new Date(targetYear, targetMonth, 1);
    const endOfSelectedMonth = new Date(targetYear, targetMonth + 1, 1);
    const startOfSixMonthsWindow = new Date(targetYear, targetMonth - 5, 1);

    // 5 requêtes parallèles au lieu de 15 requêtes séquentielles N+1
    const [revenueAgg, expenseAgg, categoryGroup, sixMonthsPayments, sixMonthsExpenses] =
      await Promise.all([
        prisma.payment.aggregate({
          where: {
            tenantId,
            order: { deletedAt: null },
            createdAt: { gte: startOfSelectedMonth, lt: endOfSelectedMonth },
          },
          _sum: { amount: true },
          _count: true,
        }),

        prisma.expense.aggregate({
          where: {
            tenantId,
            date: { gte: startOfSelectedMonth, lt: endOfSelectedMonth },
          },
          _sum: { amount: true },
          _count: true,
        }),

        prisma.expense.groupBy({
          by: ["category"],
          where: {
            tenantId,
            date: { gte: startOfSelectedMonth, lt: endOfSelectedMonth },
          },
          _sum: { amount: true },
          _count: true,
        }),

        prisma.payment.findMany({
          where: {
            tenantId,
            order: { deletedAt: null },
            createdAt: { gte: startOfSixMonthsWindow, lt: endOfSelectedMonth },
          },
          select: { amount: true, createdAt: true },
        }),

        prisma.expense.findMany({
          where: {
            tenantId,
            date: { gte: startOfSixMonthsWindow, lt: endOfSelectedMonth },
          },
          select: { amount: true, date: true },
        }),
      ]);

    const revenue = revenueAgg._sum.amount || 0;
    const expenses = expenseAgg._sum.amount || 0;
    const netProfit = revenue - expenses;
    const margin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

    const revByMonth = new Map<string, number>();
    for (const p of sixMonthsPayments) {
      const key = formatMonthKey(new Date(p.createdAt));
      revByMonth.set(key, (revByMonth.get(key) || 0) + p.amount);
    }

    const expByMonth = new Map<string, number>();
    for (const e of sixMonthsExpenses) {
      const key = formatMonthKey(new Date(e.date));
      expByMonth.set(key, (expByMonth.get(key) || 0) + e.amount);
    }

    const monthlyComparison = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(targetYear, targetMonth - i, 1);
      const mKey = formatMonthKey(d);
      const mLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      const rev = revByMonth.get(mKey) || 0;
      const exp = expByMonth.get(mKey) || 0;
      const profit = rev - exp;

      monthlyComparison.push({
        monthKey: mKey,
        label: mLabel,
        revenue: rev,
        expenses: exp,
        netProfit: profit,
        isProfit: profit >= 0,
      });
    }

    const categoryBreakdown = categoryGroup.map((item) => ({
      category: item.category,
      amount: item._sum.amount || 0,
      count: item._count,
      percentage:
        expenses > 0 ? Math.round(((item._sum.amount || 0) / expenses) * 100) : 0,
    }));

    return successResponse({
      month: formatMonthKey(startOfSelectedMonth),
      monthLabel: `${MONTH_NAMES[startOfSelectedMonth.getMonth()]} ${startOfSelectedMonth.getFullYear()}`,
      revenue,
      paymentCount: revenueAgg._count,
      expenses,
      expenseCount: expenseAgg._count,
      netProfit,
      isProfit: netProfit >= 0,
      margin,
      categoryBreakdown,
      monthlyComparison,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
