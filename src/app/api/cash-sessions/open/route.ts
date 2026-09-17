import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { openSessionSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const body = await request.json();
    const data = openSessionSchema.parse(body);

    // Verify register exists and is active
    const register = await (prisma as any).cashRegister.findFirst({
      where: { id: data.registerId, tenantId, active: true },
    });

    if (!register) {
      return errorResponse("Caisse introuvable ou inactive", 404);
    }

    // Ensure no active open session on this register
    const activeSession = await (prisma as any).cashSession.findFirst({
      where: { registerId: data.registerId, tenantId, status: "OPEN" },
    });

    if (activeSession) {
      return errorResponse(
        `Une vacation de caisse (#${activeSession.sessionNumber}) est déjà ouverte sur "${register.name}". Clôturez-la avant d'en ouvrir une nouvelle.`,
        400
      );
    }

    // Determine next session number
    const lastSession = await (prisma as any).cashSession.findFirst({
      where: { registerId: data.registerId, tenantId },
      orderBy: { sessionNumber: "desc" },
      select: { sessionNumber: true },
    });

    const nextSessionNumber = (lastSession?.sessionNumber ?? 0) + 1;

    const newSession = await (prisma as any).cashSession.create({
      data: {
        tenantId,
        registerId: data.registerId,
        sessionNumber: nextSessionNumber,
        openedById: session.userId,
        openingAmount: data.openingAmount,
        openingNote: data.openingNote || null,
        status: "OPEN",
      },
      include: {
        register: true,
        openedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await auditLog({
      tenantId,
      userId: session.userId,
      action: "CASH_SESSION_OPENED",
      entity: "CashSession",
      entityId: newSession.id,
      details: {
        registerId: data.registerId,
        sessionNumber: nextSessionNumber,
        openingAmount: data.openingAmount,
      },
    });

    return successResponse(newSession, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
