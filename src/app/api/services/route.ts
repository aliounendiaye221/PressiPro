import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { requireAdmin } from "@/lib/rbac";
import { serviceSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await requireTenantSession();
    const services = await prisma.service.findMany({
      where: { tenantId: session.tenantId, active: true },
      orderBy: { sortOrder: "asc" },
    });
    return successResponse(services);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const body = await request.json();
    const data = serviceSchema.parse(body);

    const existing = await prisma.service.findUnique({
      where: { tenantId_name: { tenantId: session.tenantId, name: data.name } },
    });
    if (existing) {
      return errorResponse("Un service avec ce nom existe déjà", 409);
    }

    const service = await prisma.service.create({
      data: {
        tenantId: session.tenantId,
        name: data.name,
        price: data.price,
        pricingType: data.pricingType || "PER_ITEM",
        category: data.category || null,
        isQuickItem: data.isQuickItem ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
    });

    return successResponse(service, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
