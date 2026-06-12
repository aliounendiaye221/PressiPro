import { prisma } from "./db";

/**
 * Generates a short unique order code per tenant.
 * Format: P-XXXXX (e.g., P-00042)
 */
export async function generateOrderCode(tenantId: string): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ maxNum: number }>>`
    SELECT COALESCE(
      MAX(
        CASE
          WHEN "code" ~ '^P-[0-9]+$' THEN CAST(SUBSTRING("code" FROM 3) AS INTEGER)
          ELSE NULL
        END
      ),
      0
    ) AS "maxNum"
    FROM "Order"
    WHERE "tenantId" = ${tenantId}
  `;

  const nextNum = (rows[0]?.maxNum ?? 0) + 1;
  return `P-${String(nextNum).padStart(5, "0")}`;
}
