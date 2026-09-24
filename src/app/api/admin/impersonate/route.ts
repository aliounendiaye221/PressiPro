import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/rbac";
import {
  COOKIE_NAME,
  createToken,
  tokenCookieOptions,
  impersonatorCookieOptions,
} from "@/lib/auth";
import { auditLog } from "@/lib/audit";
import { handleApiError, errorResponse, successResponse } from "@/lib/api-utils";

const impersonateSchema = z.object({
  tenantId: z.string().min(1, "ID du pressing requis"),
});

export async function POST(request: NextRequest) {
  try {
    const superAdminSession = await requireSuperAdmin();
    const body = await request.json();
    const { tenantId } = impersonateSchema.parse(body);

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { active: true },
          orderBy: [
            { role: "asc" }, // "ADMIN" comes before "AGENT" alphabetically
            { createdAt: "asc" },
          ],
        },
      },
    });

    if (!tenant) {
      return errorResponse("Pressing introuvable", 404);
    }

    if (tenant.users.length === 0) {
      return errorResponse("Ce pressing n'a aucun utilisateur actif pour l'impersonation", 400);
    }

    // Select the best user to impersonate: preferentially an ADMIN
    const targetUser =
      tenant.users.find((u: { role: string }) => u.role === "ADMIN") || tenant.users[0];

    const targetToken = await createToken({
      userId: targetUser.id,
      tenantId: tenant.id,
      role: targetUser.role,
      email: targetUser.email,
      name: targetUser.name,
    });

    const cookieStore = await cookies();
    const currentSuperToken = cookieStore.get(COOKIE_NAME)?.value;

    if (!currentSuperToken) {
      return errorResponse("Session Super Admin invalide", 401);
    }

    await auditLog({
      tenantId: tenant.id,
      userId: superAdminSession.userId,
      action: "SUPER_ADMIN_IMPERSONATE",
      entity: "Tenant",
      entityId: tenant.id,
      details: {
        impersonatedUserId: targetUser.id,
        tenantName: tenant.name,
      },
    });

    const response = successResponse({
      success: true,
      tenantName: tenant.name,
      redirect: "/dashboard",
    });

    // Save the Super Admin token so it can be restored on exit
    const impOpts = impersonatorCookieOptions();
    response.cookies.set(impOpts.name, currentSuperToken, impOpts);

    // Swap the main session token to the target tenant user
    const tokenOpts = tokenCookieOptions();
    response.cookies.set(tokenOpts.name, targetToken, tokenOpts);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
