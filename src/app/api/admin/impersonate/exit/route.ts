import { cookies } from "next/headers";
import {
  IMPERSONATOR_COOKIE_NAME,
  verifyToken,
  createToken,
  tokenCookieOptions,
  impersonatorCookieOptions,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const impersonatorToken = cookieStore.get(IMPERSONATOR_COOKIE_NAME)?.value;

    if (!impersonatorToken) {
      return errorResponse("Aucune session d'impersonation active", 400);
    }

    const superAdminPayload = await verifyToken(impersonatorToken);

    if (!superAdminPayload || superAdminPayload.role !== "SUPER_ADMIN") {
      return errorResponse("Session Super Admin d'origine invalide ou expirée", 403);
    }

    // Re-verify in DB that the Super Admin account is still active and still SUPER_ADMIN
    const dbSuperAdmin = await prisma.user.findUnique({
      where: { id: superAdminPayload.userId },
      select: {
        id: true,
        tenantId: true,
        role: true,
        active: true,
        email: true,
        name: true,
      },
    });

    if (!dbSuperAdmin || !dbSuperAdmin.active || dbSuperAdmin.role !== "SUPER_ADMIN") {
      const clearResponse = errorResponse("Compte Super Admin désactivé ou non autorisé", 403);
      clearResponse.cookies.delete(IMPERSONATOR_COOKIE_NAME);
      return clearResponse;
    }

    const freshToken = await createToken({
      userId: dbSuperAdmin.id,
      tenantId: dbSuperAdmin.tenantId,
      role: dbSuperAdmin.role,
      email: dbSuperAdmin.email,
      name: dbSuperAdmin.name,
    });

    await auditLog({
      tenantId: dbSuperAdmin.tenantId,
      userId: dbSuperAdmin.id,
      action: "SUPER_ADMIN_IMPERSONATE_EXIT",
      entity: "Tenant",
      entityId: dbSuperAdmin.tenantId,
      details: {
        restoredSuperAdminId: dbSuperAdmin.id,
      },
    });

    const response = successResponse({
      success: true,
      redirect: "/admin",
    });

    const tokenOpts = tokenCookieOptions();
    response.cookies.set(tokenOpts.name, freshToken, tokenOpts);

    const impOpts = impersonatorCookieOptions();
    response.cookies.set(impOpts.name, "", {
      ...impOpts,
      maxAge: 0,
    });

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
