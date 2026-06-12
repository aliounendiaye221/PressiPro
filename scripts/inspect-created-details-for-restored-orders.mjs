import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function main() {
  const restored = await sql.query(`
    SELECT id, "tenantId", code, notes
    FROM "Order"
    WHERE notes LIKE 'Commande restaurée depuis AuditLog%'
    ORDER BY "tenantId", id
  `);

  const out = [];

  for (const order of restored) {
    const created = await sql.query(`
      SELECT id, details, "createdAt"
      FROM "AuditLog"
      WHERE "tenantId" = $1 AND action = 'ORDER_CREATED' AND "entityId" = $2
      ORDER BY "createdAt" DESC
      LIMIT 1
    `, [order.tenantId, order.id]);

    if (!created.length) {
      out.push({ orderId: order.id, code: order.code, hasCreatedLog: false });
      continue;
    }

    let details = null;
    try {
      details = created[0].details ? JSON.parse(created[0].details) : null;
    } catch {
      details = null;
    }

    out.push({
      orderId: order.id,
      code: order.code,
      hasCreatedLog: true,
      createdAuditId: created[0].id,
      createdAt: created[0].createdAt,
      detailKeys: details && typeof details === 'object' ? Object.keys(details) : [],
      details,
    });
  }

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
