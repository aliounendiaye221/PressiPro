import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { requireAdmin } from "@/lib/rbac";
import { createCashRegisterSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";

export async function GET() {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;

    // Retrieve cash registers
    let registers = await (prisma as any).cashRegister.findMany({
      where: { tenantId },
      include: {
        sessions: {
          where: { status: "OPEN" },
          include: {
            openedBy: { select: { id: true, name: true, email: true } },
          },
          take: 1,
        },
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    });

    // Auto-create default register if none exists yet
    if (registers.length === 0) {
      const defaultRegister = await (prisma as any).cashRegister.create({
        data: {
          tenantId,
          name: "Caisse Principale",
          code: "CS-01",
          isDefault: true,
          active: true,
        },
      });
      registers = [{ ...defaultRegister, sessions: [] }];
    }

    const formatted = registers.map((reg: any) => ({
      id: reg.id,
      name: reg.name,
      code: reg.code,
      isDefault: reg.isDefault,
      active: reg.active,
      createdAt: reg.createdAt,
      activeSession: reg.sessions[0]
        ? {
            id: reg.sessions[0].id,
            sessionNumber: reg.sessions[0].sessionNumber,
            openedAt: reg.sessions[0].openedAt,
            openedBy: reg.sessions[0].openedBy,
            openingAmount: reg.sessions[0].openingAmount,
          }
        : null,
    }));

    return successResponse(formatted);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAdmin();
    const tenantId = session.tenantId;
    const body = await request.json();
    const data = createCashRegisterSchema.parse(body);

    // Check duplicate code within tenant
    const existing = await (prisma as any).cashRegister.findFirst({
      where: { tenantId, code: data.code },
    });

    if (existing) {
      return errorResponse(`Une caisse avec le code "${data.code}" existe déjà.`, 400);
    }

    const count = await (prisma as any).cashRegister.count({ where: { tenantId } });
    const isFirst = count === 0;
    const isDefault = Boolean(data.isDefault || isFirst);

    const result = await prisma.$transaction(async (tx) => {
      if (isDefault) {
        // Reset previous default
        await (tx as any).cashRegister.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return (tx as any).cashRegister.create({
        data: {
          tenantId,
          name: data.name,
          code: data.code,
          isDefault,
          active: true,
        },
      });
    });

    await auditLog({
      tenantId,
      userId: session.userId,
      action: "CASH_REGISTER_CREATED",
      entity: "CashRegister",
      entityId: result.id,
      details: { name: result.name, code: result.code },
    });

    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
