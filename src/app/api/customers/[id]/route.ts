import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { customerSchema } from "@/lib/validators";
import { handleApiError, successResponse, errorResponse } from "@/lib/api-utils";
import { buildPhoneLookupCandidates } from "@/lib/phone";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;

    const [customer, users] = await Promise.all([
      prisma.customer.findFirst({
        where: { id, tenantId: session.tenantId },
        include: {
          orders: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              code: true,
              status: true,
              totalAmount: true,
              paidAmount: true,
              discountAmount: true,
              discountReason: true,
              notes: true,
              promisedAt: true,
              createdAt: true,
              items: {
                select: {
                  id: true,
                  name: true,
                  quantity: true,
                  unitPrice: true,
                  total: true,
                  pricingType: true,
                  weight: true,
                },
              },
              payments: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  amount: true,
                  method: true,
                  note: true,
                  createdAt: true,
                  createdBy: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.findMany({
        where: { tenantId: session.tenantId },
        select: { id: true, name: true },
      }),
    ]);

    if (!customer) {
      return errorResponse("Client introuvable", 404);
    }

    const userMap = new Map<string, string>(users.map((u) => [u.id, u.name]));

    // Aggregate statistics
    const totalOrders = customer.orders.length;
    const totalSpent = customer.orders.reduce((sum, o) => sum + o.totalAmount, 0);
    const totalPaid = customer.orders.reduce((sum, o) => sum + o.paidAmount, 0);
    const totalDebt = Math.max(0, totalSpent - totalPaid);
    const activeOrdersCount = customer.orders.filter((o) => o.status !== "LIVRE").length;

    // Collect and sort all payments across all orders
    const allPayments = customer.orders
      .flatMap((order) =>
        order.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          method: p.method,
          note: p.note,
          createdAt: p.createdAt,
          agentName: p.createdBy ? userMap.get(p.createdBy) || "Agent" : "Comptoir",
          orderId: order.id,
          orderCode: order.code,
        }))
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return successResponse({
      ...customer,
      stats: {
        totalOrders,
        totalSpent,
        totalPaid,
        totalDebt,
        activeOrdersCount,
      },
      allPayments,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;
    const body = await request.json();
    const data = customerSchema.parse(body);

    // Verify customer belongs to tenant
    const existing = await prisma.customer.findFirst({
      where: { id, tenantId: session.tenantId },
    });
    if (!existing) {
      return errorResponse("Client introuvable", 404);
    }

    // Check phone uniqueness (if changed)
    if (data.phone !== existing.phone) {
      const phoneCandidates = buildPhoneLookupCandidates(data.phone);
      const phonesToCheck = phoneCandidates.length > 0 ? phoneCandidates : [data.phone];
      const duplicate = await prisma.customer.findFirst({
        where: {
          tenantId: session.tenantId,
          id: { not: id },
          OR: phonesToCheck.map((phone) => ({ phone })),
        },
        select: { id: true },
      });
      if (duplicate) {
        return errorResponse("Un client avec ce numéro existe déjà", 409);
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        address: data.address || null,
        notes: data.notes || null,
      },
    });

    return successResponse(customer);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireTenantSession();
    const { id } = await params;

    const customer = await prisma.customer.findFirst({
      where: { id, tenantId: session.tenantId },
      include: { _count: { select: { orders: true } } },
    });

    if (!customer) {
      return errorResponse("Client introuvable", 404);
    }

    if (customer._count.orders > 0) {
      return errorResponse("Impossible de supprimer un client ayant des commandes", 400);
    }

    await prisma.customer.delete({ where: { id } });
    return successResponse({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
