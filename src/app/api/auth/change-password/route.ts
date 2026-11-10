import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, verifyPassword, hashPassword } from "@/lib/auth";
import { strongPasswordSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/client-ip";

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const clientIp = getClientIp(request);
    const rate = await checkRateLimit(
      `auth:change-pw:${session.userId}:${clientIp}`,
      10,
      10 * 60 * 1000
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Trop de tentatives. Réessayez dans quelques minutes." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || typeof currentPassword !== "string" || currentPassword.length > 128) {
      return errorResponse("Veuillez saisir votre mot de passe actuel", 400);
    }

    const parsedNewPassword = strongPasswordSchema.safeParse(newPassword);
    if (!parsedNewPassword.success) {
      return errorResponse(
        parsedNewPassword.error.errors[0]?.message ||
          "Le nouveau mot de passe ne respecte pas les critères de sécurité",
        400
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, password: true, tenantId: true },
    });

    if (!user) {
      return errorResponse("Utilisateur introuvable", 404);
    }

    const isCurrentValid = await verifyPassword(currentPassword, user.password);
    if (!isCurrentValid) {
      return errorResponse("Le mot de passe actuel est incorrect", 400);
    }

    const hashedPassword = await hashPassword(parsedNewPassword.data);

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
