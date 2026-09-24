import {
  createToken,
  requireSession,
  tokenCookieOptions,
  IMPERSONATOR_COOKIE_NAME,
} from "@/lib/auth";
import { cookies } from "next/headers";
import { successResponse, handleApiError, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const session = await requireSession();
    const refreshedToken = await createToken(session);
    const opts = tokenCookieOptions();

    const cookieStore = await cookies();
    const isImpersonated = Boolean(
      cookieStore.get(IMPERSONATOR_COOKIE_NAME)?.value
    );

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { id: true, name: true, phone: true, address: true, logoUrl: true },
    });

    if (!tenant && session.role !== "SUPER_ADMIN") {
      return errorResponse("Tenant introuvable", 404);
    }

    const response = successResponse({
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
      },
      tenant,
      isImpersonated,
    });

    response.cookies.set(opts.name, refreshedToken, opts);
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
