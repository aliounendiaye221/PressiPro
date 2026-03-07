import { prisma } from "./db";

/**
 * Generates a short unique order code per tenant.
 * Format: P-XXXXX (e.g., P-00042)
 */
export async function generateOrderCode(tenantId: string): Promise<string> {
  const lastOrder = await prisma.order.findFirst({
    where: { tenantId },
    orderBy: { createdAt: "desc" },
    select: { code: true },
  });

  let nextNum = 1;
  if (lastOrder?.code) {
    const match = lastOrder.code.match(/P-(\d+)/);
    if (match) {
      nextNum = parseInt(match[1], 10) + 1;
    }
  }

  const code = `P-${String(nextNum).padStart(5, "0")}`;

  // Verify uniqueness (edge case with concurrent requests)
  const exists = await prisma.order.findUnique({
    where: { tenantId_code: { tenantId, code } },
  });

  if (exists) {
    // Fallback: find max and increment
    const allOrders = await prisma.order.findMany({
      where: { tenantId },
      select: { code: true },
      orderBy: { code: "desc" },
      take: 1,
    });
    if (allOrders.length > 0) {
      const m = allOrders[0].code.match(/P-(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10) + 1;
        return `P-${String(n).padStart(5, "0")}`;
      }
    }
  }

  return code;
}
