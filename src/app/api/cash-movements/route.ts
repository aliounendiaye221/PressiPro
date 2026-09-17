import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { cashMovementSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const { searchParams } = new URL(request.url);

    const sessionId = searchParams.get("sessionId");
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "30", 10)));
    const skip = (page - 1) * limit;

    const where: any = { tenantId };

    if (sessionId) {
      where.sessionId = sessionId;
    }

    if (type && (type === "CASH_IN" || type === "CASH_OUT")) {
      where.type = type;
    }

    if (category) {
      where.category = category;
    }

    const [total, movements] = await Promise.all([
      (prisma as any).cashMovement.count({ where }),
      (prisma as any).cashMovement.findMany({
        where,
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          session: {
            select: {
              id: true,
              sessionNumber: true,
              status: true,
              register: { select: { name: true, code: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return successResponse({
      movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const body = await request.json();
    const data = cashMovementSchema.parse(body);

    // Resolve target session
    let targetSessionId = data.sessionId;

    if (!targetSessionId) {
      // Find open session
      const activeSession = await (prisma as any).cashSession.findFirst({
        where: { tenantId, status: "OPEN" },
        orderBy: { openedAt: "desc" },
      });

      if (!activeSession) {
        return errorResponse(
          "Impossible d'enregistrer le mouvement : aucune vacation de caisse n'est ouverte. Veuillez d'abord ouvrir une session.",
          400
        );
      }
      targetSessionId = activeSession.id;
    } else {
      const existingSession = await (prisma as any).cashSession.findFirst({
        where: { id: targetSessionId, tenantId },
      });

      if (!existingSession) {
        return errorResponse("Session de caisse introuvable", 404);
      }

      if (existingSession.status === "CLOSED") {
        return errorResponse("Impossible d'ajouter un mouvement sur une session déjà clôturée", 400);
      }
    }

    const movement = await (prisma as any).cashMovement.create({
      data: {
        tenantId,
        sessionId: targetSessionId,
        type: data.type,
        amount: data.amount,
        category: data.category,
        reason: data.reason,
        beneficiary: data.beneficiary || null,
        receiptRef: data.receiptRef || null,
        createdById: session.userId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    await auditLog({
      tenantId,
      userId: session.userId,
      action: "CASH_MOVEMENT_CREATED",
      entity: "CashMovement",
      entityId: movement.id,
      details: {
        sessionId: targetSessionId,
        type: data.type,
        amount: data.amount,
        category: data.category,
        reason: data.reason,
      },
    });

    return successResponse(movement, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
