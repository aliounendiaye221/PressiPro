import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { closeSessionSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";
import { calculateSessionTotals, calculateDiscrepancy, generateZReportNumber } from "@/lib/cash";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const { id } = await params;
    const body = await request.json();
    const data = closeSessionSchema.parse(body);

    const cashSession = await (prisma as any).cashSession.findFirst({
      where: { id, tenantId },
      include: {
        register: true,
        payments: true,
        movements: true,
      },
    });

    if (!cashSession) {
      return errorResponse("Session de caisse introuvable", 404);
    }

    if (cashSession.status === "CLOSED") {
      return errorResponse("Cette session de caisse est déjà clôturée", 400);
    }

    // Calculate official theoretical figures
    const totals = calculateSessionTotals(
      cashSession.openingAmount,
      cashSession.payments,
      cashSession.movements
    );

    const { difference } = calculateDiscrepancy(data.actualCash, totals.expectedCash);
    const zReportNumber = generateZReportNumber(cashSession.sessionNumber);

    const updated = await (prisma as any).cashSession.update({
      where: { id },
      data: {
        status: "CLOSED",
        closedById: session.userId,
        closedAt: new Date(),
        expectedCash: totals.expectedCash,
        actualCash: data.actualCash,
        difference,
        expectedWave: totals.totalWaveSales,
        expectedOm: totals.totalOmSales,
        expectedOther: totals.totalOtherSales,
        closingNote: data.closingNote || null,
        zReportNumber,
      },
      include: {
        register: true,
        openedBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await auditLog({
      tenantId,
      userId: session.userId,
      action: "CASH_SESSION_CLOSED",
      entity: "CashSession",
      entityId: id,
      details: {
        zReportNumber,
        expectedCash: totals.expectedCash,
        actualCash: data.actualCash,
        difference,
        salesCount: totals.salesCount,
      },
    });

    return successResponse({
      session: updated,
      summary: totals,
      discrepancy: {
        difference,
        isBalanced: difference === 0,
        isShortage: difference < 0,
        isSurplus: difference > 0,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
