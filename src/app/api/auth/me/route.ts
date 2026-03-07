import { getSession } from "@/lib/auth";
import { successResponse, errorResponse } from "@/lib/api-utils";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return errorResponse("Non autorisé", 401);
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: { id: true, name: true, phone: true, address: true, logoUrl: true },
  });

  return successResponse({
    user: {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
    },
    tenant,
  });
}
