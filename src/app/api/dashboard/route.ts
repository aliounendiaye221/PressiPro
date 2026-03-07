import { prisma } from "@/lib/db";
import { requireTenantSession } from "@/lib/tenant";
import { handleApiError, successResponse } from "@/lib/api-utils";

export async function GET() {
  try {
    const session = await requireTenantSession();
    const tenantId = session.tenantId;
    const now = new Date();

    // Date ranges
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfDay);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay() + 1); // Monday
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Revenue calculations
    const [revenueDay, revenueWeek, revenueMonth] = await Promise.all([
      prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfDay } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfWeek } },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { tenantId, createdAt: { gte: startOfMonth } },
        _sum: { amount: true },
      }),
    ]);

    // Unpaid totals
    const unpaidOrders = await prisma.order.findMany({
      where: {
        tenantId,
        status: { not: "LIVRE" },
      },
      select: { totalAmount: true, paidAmount: true },
    });
    const totalUnpaid = unpaidOrders.reduce(
      (sum, o) => sum + (o.totalAmount - o.paidAmount),
      0
    );

    // Late orders (promisedAt < now AND not LIVRE)
    const lateOrders = await prisma.order.count({
      where: {
        tenantId,
        promisedAt: { lt: now },
        status: { notIn: ["LIVRE"] },
      },
    });

    // Orders by status
    const ordersByStatus = await prisma.order.groupBy({
      by: ["status"],
      where: { tenantId },
      _count: true,
    });

    // Today's payments by method
    const paymentsByMethod = await prisma.payment.groupBy({
      by: ["method"],
      where: { tenantId, createdAt: { gte: startOfDay } },
      _sum: { amount: true },
      _count: true,
    });

    // Recent payments
    const recentPayments = await prisma.payment.findMany({
      where: { tenantId },
      include: {
        order: { select: { code: true, customer: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return successResponse({
      revenue: {
        day: revenueDay._sum.amount || 0,
        week: revenueWeek._sum.amount || 0,
        month: revenueMonth._sum.amount || 0,
      },
      totalUnpaid,
      lateOrders,
      ordersByStatus: Object.fromEntries(
        ordersByStatus.map((s) => [s.status, s._count])
      ),
      paymentsByMethod: paymentsByMethod.map((p) => ({
        method: p.method,
        total: p._sum.amount || 0,
        count: p._count,
      })),
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        orderCode: p.order.code,
        customerName: p.order.customer.name,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
