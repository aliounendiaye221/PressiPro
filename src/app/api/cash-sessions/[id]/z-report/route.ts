import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { calculateSessionTotals, calculateDiscrepancy, getCategoryLabel } from "@/lib/cash";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const { id } = await params;

    const [tenant, cashSession] = await Promise.all([
      prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          phone: true,
          address: true,
          logoUrl: true,
        },
      }),
      (prisma as any).cashSession.findFirst({
        where: { id, tenantId },
        include: {
          register: true,
          openedBy: { select: { name: true } },
          closedBy: { select: { name: true } },
          payments: {
            include: {
              order: { select: { code: true } },
            },
          },
          movements: true,
        },
      }),
    ]);

    if (!cashSession || !tenant) {
      return errorResponse("Session de caisse introuvable", 404);
    }

    const totals = calculateSessionTotals(
      cashSession.openingAmount,
      cashSession.payments,
      cashSession.movements
    );

    const isClosed = cashSession.status === "CLOSED";
    const reportType = isClosed ? "TICKET_Z" : "TICKET_X";
    const reportTitle = isClosed ? "CLÔTURE DE CAISSE (TICKET Z)" : "LECTURE PROVISOIRE (TICKET X)";

    const actualCash = isClosed ? cashSession.actualCash ?? totals.expectedCash : totals.expectedCash;
    const difference = isClosed ? cashSession.difference ?? 0 : 0;
    const discrepancy = calculateDiscrepancy(actualCash, totals.expectedCash);

    // Group expenses by category
    const expensesByCategory: Record<string, { label: string; total: number; count: number }> = {};
    for (const m of cashSession.movements) {
      if (m.type === "CASH_OUT") {
        if (!expensesByCategory[m.category]) {
          expensesByCategory[m.category] = {
            label: getCategoryLabel(m.category),
            total: 0,
            count: 0,
          };
        }
        expensesByCategory[m.category].total += m.amount;
        expensesByCategory[m.category].count += 1;
      }
    }

    const reportData = {
      reportType,
      reportTitle,
      zReportNumber: cashSession.zReportNumber || `X-SESSION-${cashSession.sessionNumber}`,
      sessionNumber: cashSession.sessionNumber,
      status: cashSession.status,
      tenant: {
        name: tenant.name,
        phone: tenant.phone,
        address: tenant.address,
      },
      register: {
        name: cashSession.register.name,
        code: cashSession.register.code,
      },
      openedAt: cashSession.openedAt,
      openedByName: cashSession.openedBy.name,
      closedAt: cashSession.closedAt,
      closedByName: cashSession.closedBy?.name || null,
      financials: {
        openingAmount: cashSession.openingAmount,
        totalCashSales: totals.totalCashSales,
        totalWaveSales: totals.totalWaveSales,
        totalOmSales: totals.totalOmSales,
        totalOtherSales: totals.totalOtherSales,
        totalSales: totals.totalSales,
        salesCount: totals.salesCount,
        manualCashIn: totals.manualCashIn,
        manualCashOut: totals.manualCashOut,
        expectedCash: totals.expectedCash,
        actualCash,
        difference,
        discrepancy,
      },
      expensesByCategory: Object.values(expensesByCategory),
      closingNote: cashSession.closingNote,
      generatedAt: new Date(),
    };

    return successResponse(reportData);
  } catch (error) {
    return handleApiError(error);
  }
}
