import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { requireAdmin } from "@/lib/rbac";
import { createExpenseSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { parsePagination } from "@/lib/pagination";
import { auditLog } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || "";
    const category = searchParams.get("category") || "";
    const monthStr = searchParams.get("month") || ""; // Format: YYYY-MM
    const { page, limit } = parsePagination(searchParams, { maxLimit: 100 });

    const where: any = { tenantId: session.tenantId };

    if (category) {
      where.category = category;
    }

    if (monthStr && /^\d{4}-\d{2}$/.test(monthStr)) {
      const [year, month] = monthStr.split("-").map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 1);
      where.date = { gte: startOfMonth, lt: endOfMonth };
    }

    if (search) {
      where.OR = [
        { description: { contains: search, mode: "insensitive" } },
        { supplier: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
      ];
    }

    const [expenses, total, totalSum] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    return successResponse({
      expenses,
      total,
      page,
      limit,
      totalAmount: totalSum._sum.amount || 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const body = await request.json();
    const data = createExpenseSchema.parse(body);

    const expenseDate = data.date ? new Date(data.date) : new Date();

    const expense = await prisma.expense.create({
      data: {
        tenantId: session.tenantId,
        category: data.category as any,
        description: data.description.trim(),
        amount: data.amount,
        date: expenseDate,
        paymentMethod: data.paymentMethod as any,
        supplier: data.supplier ? data.supplier.trim() : null,
        notes: data.notes ? data.notes.trim() : null,
        createdBy: session.userId,
      },
    });

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "EXPENSE_CREATED",
      entity: "Expense",
      entityId: expense.id,
      details: {
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
      },
    });

    return successResponse(expense, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
