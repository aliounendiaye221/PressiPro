import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { createOrderSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { generateOrderCode } from "@/lib/order-code";
import { auditLog } from "@/lib/audit";
import { PaymentMethod } from "@prisma/client";
import { parsePagination } from "@/lib/pagination";
import { warmOrderReceiptPdf } from "@/lib/receipt/pdf";
import { computeOrderItems, computeFinalTotal } from "@/lib/order-utils";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const unpaid = searchParams.get("unpaid") === "true";
    const late = searchParams.get("late") === "true";
    const period = searchParams.get("period") || "";
    const { page, limit } = parsePagination(searchParams, { maxLimit: 50 });

    const where: Record<string, unknown> = { tenantId: session.tenantId, deletedAt: null };

    if (status && ["RECU", "TRAITEMENT", "PRET", "LIVRE"].includes(status)) {
      where.status = status;
    }

    if (unpaid) {
      where.paidAmount = { lt: prisma.order.fields.totalAmount };
      if (!status) {
        where.status = { not: "LIVRE" };
      }
    }

    if (late) {
      where.promisedAt = { lt: new Date() };
      if (!status) {
        where.status = { notIn: ["LIVRE"] };
      }
    }

    if (period) {
      const now = new Date();
      if (period === "today") {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        where.createdAt = { gte: startOfDay };
      } else if (period === "week") {
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const day = startOfWeek.getDay() || 7;
        startOfWeek.setDate(startOfWeek.getDate() - day + 1);
        where.createdAt = { gte: startOfWeek };
      } else if (period === "month") {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        where.createdAt = { gte: startOfMonth };
      }
    }

    if (search) {
      where.OR = [
        { code: { contains: search, mode: "insensitive" } },
        { customer: { name: { contains: search, mode: "insensitive" } } },
        { customer: { phone: { contains: search } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: { select: { name: true, quantity: true, unitPrice: true, total: true } },
          _count: { select: { payments: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.order.count({ where }),
    ]);

    return successResponse({ orders, total, page, limit });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const body = await request.json();
    const data = createOrderSchema.parse(body);

    // Verify customer belongs to tenant
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, tenantId: session.tenantId },
    });
    if (!customer) {
      return errorResponse("Client introuvable", 404);
    }

    // Fetch services and compute total
    const serviceIds = data.items.map((i) => i.serviceId);
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId: session.tenantId, active: true },
    });

    if (services.length !== serviceIds.length) {
      return errorResponse("Un ou plusieurs services sont invalides", 400);
    }

    const serviceMap = new Map<string, typeof services[0]>(services.map((s: any) => [s.id, s]));
    const { items: orderItems, itemsTotal } = computeOrderItems(data.items, serviceMap);


    // Handle discount
    const { totalAmount, cappedDiscount: discountAmount } = computeFinalTotal(
      itemsTotal,
      data.discountAmount ?? 0
    );
    const discountReason = data.discountReason || null;

    // Determine advance payment
    const advanceAmount = data.advanceAmount && data.advanceAmount > 0
      ? Math.min(data.advanceAmount, totalAmount)
      : 0;

    let order;
    let retries = 3;
    while (retries > 0) {
      try {
        order = await prisma.$transaction(async (tx) => {
          const code = await generateOrderCode(session.tenantId, tx);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const newOrder = await (tx as any).order.create({
            data: {
              tenantId: session.tenantId,
              code,
              customerId: data.customerId,
              totalAmount,
              discountAmount,
              discountReason,
              paidAmount: advanceAmount,
              notes: data.notes || null,
              promisedAt: data.promisedAt ? new Date(data.promisedAt) : null,
              items: { create: orderItems },
              statusHistory: {
                create: {
                  fromStatus: null,
                  toStatus: "RECU",
                  changedBy: session.userId,
                },
              },
            },
            include: {
              customer: { select: { id: true, name: true, phone: true } },
              items: true,
            },
          });

          // Create advance payment if any
          if (advanceAmount > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (tx as any).payment.create({
              data: {
                tenantId: session.tenantId,
                orderId: newOrder.id,
                amount: advanceAmount,
                method: (data.advanceMethod as PaymentMethod) || "CASH",
                createdBy: session.userId,
              },
            });
          }

          return newOrder;
        });

        break;
      } catch (error: unknown) {
        const prismaError = error as {
          code?: string;
          meta?: { target?: string | string[] };
        };
        const target = prismaError.meta?.target;
        const targetText = Array.isArray(target) ? target.join(",") : String(target ?? "");
        const isOrderCodeConflict =
          prismaError.code === "P2002"
          && (
            targetText.length === 0
            || targetText.includes("Order_tenantId_code_key")
            || (targetText.includes("tenantId") && targetText.includes("code"))
          );

        if (isOrderCodeConflict && retries > 1) {
          retries--;
          continue;
        }
        throw error;
      }
    }

    if (!order) {
      throw new Error("Failed to generate a unique order code. Please try again.");
    }

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "ORDER_CREATED",
      entity: "Order",
      entityId: order.id,
      details: { code: order.code, totalAmount, advanceAmount },
    });

    await warmOrderReceiptPdf({
      tenantId: session.tenantId,
      orderId: order.id,
    }).catch((error) => {
      console.warn("[ReceiptWarmup] Order creation warmup failed", {
        tenantId: session.tenantId,
        orderId: order.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    return successResponse(order, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
