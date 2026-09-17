import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { calculateSessionTotals, calculateDiscrepancy } from "@/lib/cash";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const { id } = await params;

    const cashSession = await (prisma as any).cashSession.findFirst({
      where: { id, tenantId },
      include: {
        register: true,
        openedBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } },
        payments: {
          include: {
            order: {
              select: {
                id: true,
                code: true,
                customer: { select: { id: true, name: true, phone: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        movements: {
          include: {
            createdBy: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!cashSession) {
      return errorResponse("Session de caisse introuvable", 404);
    }

    const summary = calculateSessionTotals(
      cashSession.openingAmount,
      cashSession.payments,
      cashSession.movements
    );

    const discrepancy =
      cashSession.actualCash !== null
        ? calculateDiscrepancy(cashSession.actualCash, cashSession.expectedCash ?? summary.expectedCash)
        : null;

    return successResponse({
      session: cashSession,
      summary,
      discrepancy,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
