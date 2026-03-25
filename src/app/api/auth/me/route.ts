import { createToken, requireSession, tokenCookieOptions } from "@/lib/auth";
import { successResponse, handleApiError, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const session = await requireSession();
    const refreshedToken = await createToken(session);
    const cookieStore = await cookies();
    const opts = tokenCookieOptions();
    cookieStore.set(opts.name, refreshedToken, opts);

    const tenant = await prisma.tenant.findUnique({
      where: { id: session.tenantId },
      select: { id: true, name: true, phone: true, address: true, logoUrl: true },
    });

    if (!tenant && session.role !== "SUPER_ADMIN") {
      return errorResponse("Tenant introuvable", 404);
    }

    return successResponse({
      user: {
        id: session.userId,
        name: session.name,
        email: session.email,
        role: session.role,
      },
      tenant,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
