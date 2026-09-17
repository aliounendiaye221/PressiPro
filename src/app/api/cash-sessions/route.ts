import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, successResponse } from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const { searchParams } = new URL(request.url);

    const status = searchParams.get("status");
    const registerId = searchParams.get("registerId");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (status && (status === "OPEN" || status === "CLOSED")) {
      where.status = status;
    }

    if (registerId) {
      where.registerId = registerId;
    }

    const [total, sessions] = await Promise.all([
      (prisma as any).cashSession.count({ where }),
      (prisma as any).cashSession.findMany({
        where,
        include: {
          register: { select: { id: true, name: true, code: true } },
          openedBy: { select: { id: true, name: true, email: true } },
          closedBy: { select: { id: true, name: true, email: true } },
          _count: {
            select: {
              payments: true,
              movements: true,
            },
          },
        },
        orderBy: { openedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return successResponse({
      sessions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
