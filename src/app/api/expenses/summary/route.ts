import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, successResponse } from "@/lib/api-utils";

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
];

export async function GET(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const { searchParams } = new URL(request.url);
    const tenantId = session.tenantId;

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const selectedMonthKey = searchParams.get("month") || currentMonthKey;

    let targetYear = now.getFullYear();
    let targetMonth = now.getMonth(); // 0-indexed

    if (/^\d{4}-\d{2}$/.test(selectedMonthKey)) {
      const [y, m] = selectedMonthKey.split("-").map(Number);
      targetYear = y;
      targetMonth = m - 1;
    }

    const startOfSelectedMonth = new Date(targetYear, targetMonth, 1);
    const endOfSelectedMonth = new Date(targetYear, targetMonth + 1, 1);

    // Run queries for selected month
    const [revenueAgg, expenseAgg, categoryGroup] = await Promise.all([
      // Total Revenue collected in this month
      prisma.payment.aggregate({
        where: {
          tenantId,
          createdAt: { gte: startOfSelectedMonth, lt: endOfSelectedMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Total Expenses in this month
      prisma.expense.aggregate({
        where: {
          tenantId,
          date: { gte: startOfSelectedMonth, lt: endOfSelectedMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // Expenses by category
      prisma.expense.groupBy({
        by: ["category"],
        where: {
          tenantId,
          date: { gte: startOfSelectedMonth, lt: endOfSelectedMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const revenue = revenueAgg._sum.amount || 0;
    const expenses = expenseAgg._sum.amount || 0;
    const netProfit = revenue - expenses;
    const margin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;

    // Monthly historical comparison (last 6 months)
    const monthlyComparison = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(targetYear, targetMonth - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mLabel = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;

      const [mRev, mExp] = await Promise.all([
        prisma.payment.aggregate({
          where: { tenantId, createdAt: { gte: mStart, lt: mEnd } },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: { tenantId, date: { gte: mStart, lt: mEnd } },
          _sum: { amount: true },
        }),
      ]);

      const rev = mRev._sum.amount || 0;
      const exp = mExp._sum.amount || 0;
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

    // Format category breakdown
    const categoryBreakdown = categoryGroup.map((item) => ({
      category: item.category,
      amount: item._sum.amount || 0,
      count: item._count,
      percentage: expenses > 0 ? Math.round(((item._sum.amount || 0) / expenses) * 100) : 0,
    }));

    return successResponse({
      month: selectedMonthKey,
      monthLabel: `${MONTH_NAMES[targetMonth]} ${targetYear}`,
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
