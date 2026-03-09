import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    const existing = await prisma.user.findFirst({
      where: { id, tenantId: session.tenantId },
    });
    if (!existing) {
      return errorResponse("Utilisateur introuvable", 404);
    }

    // Cannot modify yourself
    if (existing.id === session.userId) {
      return errorResponse("Vous ne pouvez pas modifier votre propre compte", 400);
    }

    // Cannot modify a SUPER_ADMIN
    if (existing.role === "SUPER_ADMIN") {
      return errorResponse("Impossible de modifier un Super Admin", 403);
    }

    const updateData: { active?: boolean; role?: "ADMIN" | "AGENT" } = {};

    if (typeof body.active === "boolean") {
      updateData.active = body.active;
    }

    if (body.role === "ADMIN" || body.role === "AGENT") {
      updateData.role = body.role;
    }

    if (Object.keys(updateData).length === 0) {
      return errorResponse("Aucune modification fournie", 400);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}
