import { cookies } from "next/headers";
import {
  IMPERSONATOR_COOKIE_NAME,
  verifyToken,
  tokenCookieOptions,
  impersonatorCookieOptions,
} from "@/lib/auth";
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

    await auditLog({
      tenantId: superAdminPayload.tenantId,
      userId: superAdminPayload.userId,
      action: "SUPER_ADMIN_IMPERSONATE_EXIT",
      entity: "Tenant",
      entityId: superAdminPayload.tenantId,
      details: {
        restoredSuperAdminId: superAdminPayload.userId,
      },
    });

    const response = successResponse({
      success: true,
      redirect: "/admin",
    });

    // Restore the Super Admin session token
    const tokenOpts = tokenCookieOptions();
    response.cookies.set(tokenOpts.name, impersonatorToken, tokenOpts);

    // Clear the impersonator cookie
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
