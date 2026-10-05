import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { requireAdmin } from "@/lib/rbac";
import { updateExpenseSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { auditLog } from "@/lib/audit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const expense = await prisma.expense.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!expense) {
      return errorResponse("Dépense introuvable", 404);
    }

    return successResponse(expense);
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
    const data = updateExpenseSchema.parse(body);

    const existing = await prisma.expense.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return errorResponse("Dépense introuvable", 404);
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(data.description !== undefined && { description: data.description.trim() }),
        ...(data.amount !== undefined && { amount: data.amount }),
        ...(data.category !== undefined && { category: data.category as any }),
        ...(data.paymentMethod !== undefined && { paymentMethod: data.paymentMethod as any }),
        ...(data.date !== undefined && { date: new Date(data.date) }),
        ...(data.supplier !== undefined && { supplier: data.supplier ? data.supplier.trim() : null }),
        ...(data.notes !== undefined && { notes: data.notes ? data.notes.trim() : null }),
      },
    });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "EXPENSE_UPDATED",
      entity: "Expense",
      entityId: id,
      details: {
        oldAmount: existing.amount,
        newAmount: updated.amount,
        description: updated.description,
      },
    });

    return successResponse(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAdmin();
    const { id } = await params;

    const existing = await prisma.expense.findFirst({
      where: { id, tenantId: session.tenantId },
    });

    if (!existing) {
      return errorResponse("Dépense introuvable", 404);
    }

    await prisma.expense.delete({
      where: { id },
    });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "EXPENSE_DELETED",
      entity: "Expense",
      entityId: id,
      details: {
        amount: existing.amount,
        description: existing.description,
      },
    });

    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
