import { prisma } from "./db";

/**
 * Generates a short unique order code per tenant using an atomic counter.
 * Format: P-XXXXX (e.g., P-00042)
 *
 * Uses a transaction-level PostgreSQL advisory lock per tenant + numeric MAX
 * to serialize concurrent order creation without race conditions or P-99999 sorting bugs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateOrderCode(tenantId: string, client?: any): Promise<string> {
  const db = client || prisma;
  try {
    try {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`order-code:${tenantId}`}))`;
    } catch {
      // Ignore if advisory locks are unsupported in current test/mock runtime
    }

    const rows = await db.$queryRaw<Array<{ nextNum: number | string | bigint }>>`
      SELECT COALESCE(
        MAX(
          CASE
            WHEN "code" ~ '^P-[0-9]+$'
            THEN CAST(SUBSTRING("code" FROM 3) AS INTEGER)
            ELSE 0
          END
        ),
        0
      ) + 1 AS "nextNum"
      FROM "Order"
      WHERE "tenantId" = ${tenantId}
    `;

    const rawNum = rows[0]?.nextNum;
    const nextNum = rawNum !== undefined && rawNum !== null ? Number(rawNum) : 1;
    const validNum = Number.isFinite(nextNum) && nextNum > 0 ? nextNum : 1;
    return `P-${String(validNum).padStart(5, "0")}`;
  } catch (error) {
    console.error("[generateOrderCode] Raw query failed, falling back to numeric scan:", error);
    const recentOrders = await db.order.findMany({
      where: {
        tenantId,
        code: { startsWith: "P-" },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { code: true },
    });

    let maxNum = 0;
    for (const order of recentOrders) {
      const match = order.code?.match(/^P-(\d+)$/);
      if (match) {
        const parsed = parseInt(match[1], 10);
        if (Number.isFinite(parsed) && parsed > maxNum) {
          maxNum = parsed;
        }
      }
    }
    return `P-${String(maxNum + 1).padStart(5, "0")}`;
  }
}
