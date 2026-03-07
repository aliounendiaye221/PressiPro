import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;

    const order = await prisma.order.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        customer: true,
        items: {
          include: { service: { select: { id: true, name: true } } },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!order) {
      return errorResponse("Commande introuvable", 404);
    }

    return successResponse(order);
  } catch (error) {
    return handleApiError(error);
  }
}
