import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, successResponse } from "@/lib/api-utils";
import { calculateSessionTotals } from "@/lib/cash";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const { searchParams } = new URL(request.url);
    const registerId = searchParams.get("registerId");

    const whereClause: any = {
      tenantId,
      status: "OPEN",
    };

    if (registerId) {
      whereClause.registerId = registerId;
    }

    const activeSession = await (prisma as any).cashSession.findFirst({
      where: whereClause,
      include: {
        register: true,
        openedBy: { select: { id: true, name: true, email: true } },
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
      orderBy: { openedAt: "desc" },
    });

    if (!activeSession) {
      return successResponse({ hasActiveSession: false, session: null });
    }

    // Compute live financial summary
    const summary = calculateSessionTotals(
      activeSession.openingAmount,
      activeSession.payments,
      activeSession.movements
    );

    return successResponse({
      hasActiveSession: true,
      session: {
        ...activeSession,
        summary,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
