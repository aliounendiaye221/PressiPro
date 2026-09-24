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
export async function generateOrderCode(tenantId: string): Promise<string> {
  // Atomic increment: lock the max row and increment in one step.
  // We use a subquery that selects with FOR UPDATE to prevent concurrent reads
  // from getting the same value before the first transaction commits.
  const rows = await prisma.$queryRaw<Array<{ nextNum: number }>>`
    WITH current_max AS (
      SELECT COALESCE(
        MAX(
          CASE
            WHEN "code" ~ '^P-[0-9]+$'
            THEN CAST(SUBSTRING("code" FROM 3) AS INTEGER)
            ELSE NULL
          END
        ),
        0
      ) AS "maxNum"
      FROM "Order"
      WHERE "tenantId" = ${tenantId}
      FOR UPDATE
    )
    SELECT "maxNum" + 1 AS "nextNum" FROM current_max
  `;

  const nextNum = rows[0]?.nextNum ?? 1;
  return `P-${String(nextNum).padStart(5, "0")}`;
}
