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

    const existing = await prisma.service.findFirst({
      where: { id, tenantId: session.tenantId },
    });
    if (!existing) {
      return errorResponse("Service introuvable", 404);
    }

    const service = await prisma.service.update({
      where: { id },
      data: {
        name: data.name,
        price: data.price,
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

    // Soft delete: deactivate instead of removing
    await prisma.service.update({
      where: { id },
      data: { active: false },
    });

    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
