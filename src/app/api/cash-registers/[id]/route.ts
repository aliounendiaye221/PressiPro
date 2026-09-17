import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { requireAdmin } from "@/lib/rbac";
import { updateCashRegisterSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;

    const register = await (prisma as any).cashRegister.findFirst({
      where: { id, tenantId: session.tenantId },
      include: {
        sessions: {
          orderBy: { sessionNumber: "desc" },
          take: 5,
        },
      },
    });

    if (!register) {
      return errorResponse("Caisse introuvable", 404);
    }

    return successResponse(register);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = updateCashRegisterSchema.parse(body);

    const existing = await (prisma as any).cashRegister.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return errorResponse("Caisse introuvable", 404);
    }

    if (data.code && data.code !== existing.code) {
      const duplicate = await (prisma as any).cashRegister.findFirst({
        where: { tenantId: session.tenantId, code: data.code, id: { not: id } },
      });
      if (duplicate) {
        return errorResponse(`Le code "${data.code}" est déjà utilisé.`, 400);
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await (tx as any).cashRegister.updateMany({
          where: { tenantId: session.tenantId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      return (tx as any).cashRegister.update({
        where: { id },
        data: {
          name: data.name ?? existing.name,
          code: data.code ?? existing.code,
          active: data.active ?? existing.active,
          isDefault: data.isDefault ?? existing.isDefault,
        },
      });
    });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "CASH_REGISTER_UPDATED",
      entity: "CashRegister",
      entityId: id,
      details: data,
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}
