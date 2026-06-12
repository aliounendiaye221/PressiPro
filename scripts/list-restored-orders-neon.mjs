import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  const rows = await sql.query(`
    SELECT
      o.id,
      o.code,
      o."tenantId",
      t.name AS "tenantName",
      o."totalAmount",
      o."paidAmount",
      o.notes,
      o."createdAt",
      COALESCE(it."itemCount", 0)::int AS "itemCount",
      COALESCE(py."paymentCount", 0)::int AS "paymentCount"
    FROM "Order" o
    JOIN "Tenant" t ON t.id = o."tenantId"
    LEFT JOIN (
      SELECT "orderId", COUNT(*) AS "itemCount"
      FROM "OrderItem"
      GROUP BY "orderId"
    ) it ON it."orderId" = o.id
    LEFT JOIN (
      SELECT "orderId", COUNT(*) AS "paymentCount"
      FROM "Payment"
      GROUP BY "orderId"
    ) py ON py."orderId" = o.id
    WHERE o.notes LIKE 'Commande restaurée depuis AuditLog%'
    ORDER BY o."tenantId", o."createdAt" ASC
  `);

  console.log(JSON.stringify(rows, null, 2));
}

main().catch((error) => {
  console.error('List failed:', error?.message ?? error);
  process.exit(1);
});
