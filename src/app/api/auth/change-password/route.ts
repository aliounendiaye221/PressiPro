import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, verifyPassword, hashPassword } from "@/lib/auth";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const body = await request.json();

    const { currentPassword, newPassword } = body;

    if (!currentPassword || typeof currentPassword !== "string") {
      return errorResponse("Veuillez saisir votre mot de passe actuel", 400);
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      return errorResponse("Le nouveau mot de passe doit comporter au moins 6 caractères", 400);
    }

    // Retrieve the user from DB
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, password: true, tenantId: true },
    });

    if (!user) {
      return errorResponse("Utilisateur introuvable", 404);
    }

    // Verify current password
    const isCurrentValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentValid) {
      return errorResponse("Le mot de passe actuel est incorrect", 400);
    }

    // Hash and update to new password
    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await auditLog({
      tenantId: user.tenantId,
      userId: user.id,
      action: "PASSWORD_CHANGED",
      entity: "User",
      entityId: user.id,
      details: { changedBySelf: true },
    });

    return successResponse({
      message: "Votre mot de passe a été mis à jour avec succès.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
