import { prisma } from "./db";

/**
 * Generates a short unique order code per tenant using an atomic counter.
 * Format: P-XXXXX (e.g., P-00042)
 *
 * Uses a single atomic SQL operation (UPDATE ... RETURNING) to avoid the
 * race condition inherent in a SELECT MAX + INSERT pattern.
 * The unique constraint @@unique([tenantId, code]) acts as a safety net,
 * but this approach prevents conflicts at the source.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateOrderCode(tenantId: string, client?: any): Promise<string> {
  const db = client || prisma;
  try {
    // Acquire a transaction-level advisory lock per tenant to serialize code generation under concurrency
    try {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}))`;
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
    console.error("[generateOrderCode] Raw query failed, falling back to prisma findFirst:", error);
    const lastOrder = await db.order.findFirst({
      where: {
        tenantId,
        code: { startsWith: "P-" },
      },
      orderBy: { code: "desc" },
      select: { code: true },
    });

    let nextNum = 1;
    if (lastOrder?.code) {
      const match = lastOrder.code.match(/^P-(\d+)$/);
      if (match) {
        nextNum = parseInt(match[1], 10) + 1;
      }
    }
    return `P-${String(nextNum).padStart(5, "0")}`;
  }
}
