import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { createOrderSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { generateOrderCode } from "@/lib/order-code";
import { auditLog } from "@/lib/audit";
import { PaymentMethod } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await requireTenantSession();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")));

    const where: Record<string, unknown> = { tenantId: session.tenantId };

    if (status && ["RECU", "TRAITEMENT", "PRET", "LIVRE"].includes(status)) {
      where.status = status;
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

    const serviceMap = new Map(services.map((s) => [s.id, s]));
    let totalAmount = 0;
    const orderItems = data.items.map((item) => {
      const service = serviceMap.get(item.serviceId)!;
      const svc = service as { id: string; name: string; price: number; pricingType: string };
      const isPerKg = svc.pricingType === "PER_KG";
      const quantity = isPerKg ? 1 : (item.quantity ?? 1);
      const weight = isPerKg ? (item.weight ?? 1) : null;
      const total = isPerKg
        ? Math.round(svc.price * (weight ?? 1))
        : svc.price * quantity;
      totalAmount += total;
      return {
        serviceId: svc.id,
        name: svc.name,
        quantity,
        unitPrice: svc.price,
        weight,
        pricingType: svc.pricingType,
        total,
      };
    });

    const code = await generateOrderCode(session.tenantId);

    // Determine advance payment
    const advanceAmount = data.advanceAmount && data.advanceAmount > 0
      ? Math.min(data.advanceAmount, totalAmount)
      : 0;

    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          tenantId: session.tenantId,
          code,
          customerId: data.customerId,
          totalAmount,
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
        await tx.payment.create({
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

    await auditLog({
      tenantId: session.tenantId,
      userId: session.userId,
      action: "ORDER_CREATED",
      entity: "Order",
      entityId: order.id,
      details: { code, totalAmount, advanceAmount },
    });

    return successResponse(order, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
