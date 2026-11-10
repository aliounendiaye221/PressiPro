import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { serviceSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = serviceSchema.parse(body);
    const trimmedName = data.name.trim();

    const existing = await prisma.service.findFirst({
      where: { id, tenantId: session.tenantId },
    });
    if (!existing) {
      return errorResponse("Service introuvable", 404);
    }

    if (trimmedName !== existing.name) {
      const duplicate = await prisma.service.findUnique({
        where: { tenantId_name: { tenantId: session.tenantId, name: trimmedName } },
        select: { id: true },
      });
      if (duplicate && duplicate.id !== id) {
        return errorResponse("Un autre service avec ce nom existe déjà", 409);
      }
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        name: trimmedName,
        price: data.price,
        pricingType: data.pricingType ?? existing.pricingType,
        category: data.category || null,
        isQuickItem: data.isQuickItem ?? existing.isQuickItem,
        sortOrder: data.sortOrder ?? existing.sortOrder,
      },
    });

    return successResponse(service);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const existing = await prisma.service.findFirst({
      where: { id, tenantId: session.tenantId },
    });
    if (!existing) {
      return errorResponse("Service introuvable", 404);
    }

    await prisma.service.update({
      where: { id },
      data: { active: false },
    });

    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
