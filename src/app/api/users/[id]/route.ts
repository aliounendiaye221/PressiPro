import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/rbac";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { hashPassword } from "@/lib/auth";
import { strongPasswordSchema } from "@/lib/validators";

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

    if (existing.id === session.userId) {
      return errorResponse("Vous ne pouvez pas modifier votre propre compte", 400);
    }

    if (existing.role === "SUPER_ADMIN") {
      return errorResponse("Impossible de modifier un Super Admin", 403);
    }

    const updateData: {
      active?: boolean;
      role?: "ADMIN" | "AGENT";
      password?: string;
      failedLoginAttempts?: number;
      lockedUntil?: Date | null;
    } = {};

    if (typeof body.active === "boolean") {
      updateData.active = body.active;
    }

    if (body.role === "ADMIN" || body.role === "AGENT") {
      updateData.role = body.role;
    }

    if (body.password !== undefined) {
      const parsedPw = strongPasswordSchema.safeParse(body.password);
      if (!parsedPw.success) {
        return errorResponse(
          parsedPw.error.errors[0]?.message ||
            "Le mot de passe doit contenir au moins 10 caractères (majuscule, minuscule, chiffre et caractère spécial)",
          400
        );
      }
      updateData.password = await hashPassword(parsedPw.data);
      updateData.failedLoginAttempts = 0;
      updateData.lockedUntil = null;
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

    if (updateData.password) {
      await prisma.auditLog.create({
        data: {
          tenantId: session.tenantId,
          userId: session.userId,
          action: "RESET_PASSWORD",
          entity: "User",
          entityId: id,
          details: `Mot de passe réinitialisé pour l'utilisateur ${existing.email} (${existing.name})`,
        },
      });
    }

    return successResponse(user);
  } catch (error) {
    return handleApiError(error);
  }
}
