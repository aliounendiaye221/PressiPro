import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const APPLY = process.argv.includes('--apply');

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function main() {
  const restored = await sql.query(`
    SELECT id, "tenantId", code, "totalAmount", "paidAmount", notes
    FROM "Order"
    WHERE notes LIKE 'Commande restaurée depuis AuditLog%'
    ORDER BY "tenantId", "createdAt" ASC
  `);

  let candidates = 0;
  let updated = 0;

  for (const order of restored) {
    const createdLogs = await sql.query(`
      SELECT id, details, "createdAt"
      FROM "AuditLog"
      WHERE "tenantId" = $1
        AND action = 'ORDER_CREATED'
        AND "entityId" = $2
      ORDER BY "createdAt" DESC
      LIMIT 1
    `, [order.tenantId, order.id]);

    if (createdLogs.length === 0) {
      continue;
    }

    const details = safeParse(createdLogs[0].details);
    const advanceAmount = Number(details?.advanceAmount ?? 0);

    if (!Number.isFinite(advanceAmount) || advanceAmount <= 0) {
      continue;
    }

    candidates += 1;

    if (!APPLY) {
      continue;
    }

    const currentPayments = await sql.query(`
      SELECT COALESCE(SUM(amount), 0)::int AS "paid"
      FROM "Payment"
      WHERE "orderId" = $1
    `, [order.id]);

    const existingPaid = Number(currentPayments[0]?.paid ?? 0);
    const missingPaid = Math.max(0, advanceAmount - existingPaid);

    if (missingPaid > 0) {
      await sql.query(`
        INSERT INTO "Payment" (
          id, "tenantId", "orderId", amount, method, note, "createdBy", "createdAt"
        )
        VALUES (
          $1, $2, $3, $4, 'OTHER', $5, NULL, NOW()
        )
      `, [
        `restore-pay-${order.id}`,
        order.tenantId,
        order.id,
        missingPaid,
        'Acompte restauré depuis AuditLog ORDER_CREATED',
      ]);
    }

    const newPaidAmount = Math.min(order.totalAmount, advanceAmount);

    await sql.query(`
      UPDATE "Order"
      SET "paidAmount" = $2,
          notes = $3,
          "updatedAt" = NOW()
      WHERE id = $1
    `, [
      order.id,
      newPaidAmount,
      `${order.notes} | acompte restauré depuis ORDER_CREATED`,
    ]);

    updated += 1;
  }

  console.log(`Restored orders scanned: ${restored.length}`);
  console.log(`Candidate orders with recoverable advance: ${candidates}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log(`Orders updated: ${updated}`);
}

main().catch((error) => {
  console.error('Reconcile failed:', error?.message ?? error);
  process.exit(1);
});
