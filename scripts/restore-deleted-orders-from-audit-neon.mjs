import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);
const APPLY = process.argv.includes('--apply');

function parseDetails(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function ensureFallbackCustomer(tenantId) {
  const existing = await sql.query(`
    SELECT id
    FROM "Customer"
    WHERE "tenantId" = $1
    ORDER BY "createdAt" ASC
    LIMIT 1
  `, [tenantId]);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const fallbackId = `restored-customer-${tenantId}`;
  const phoneTail = tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).padStart(8, '0');
  const fallbackPhone = `+22199${phoneTail}`;

  await sql.query(`
    INSERT INTO "Customer" ("id", "tenantId", "name", "phone", "createdAt", "updatedAt")
    VALUES ($1, $2, $3, $4, NOW(), NOW())
    ON CONFLICT ("tenantId", "phone") DO NOTHING
  `, [fallbackId, tenantId, 'Client restauration', fallbackPhone]);

  const ensured = await sql.query(`
    SELECT id
    FROM "Customer"
    WHERE "tenantId" = $1
    ORDER BY "createdAt" ASC
    LIMIT 1
  `, [tenantId]);

  if (ensured.length === 0) {
    throw new Error(`No customer available for tenant ${tenantId}`);
  }

  return ensured[0].id;
}

async function resolveOrderCode(tenantId, preferredCode) {
  let candidate = preferredCode;
  let attempt = 1;

  while (attempt <= 50) {
    const rows = await sql.query(`
      SELECT id
      FROM "Order"
      WHERE "tenantId" = $1 AND "code" = $2
      LIMIT 1
    `, [tenantId, candidate]);

    if (rows.length === 0) {
      return candidate;
    }

    candidate = `${preferredCode}-R${attempt}`;
    attempt += 1;
  }

  throw new Error(`Unable to find unique code for ${preferredCode} on tenant ${tenantId}`);
}

async function main() {
  const deletedLogs = await sql.query(`
    SELECT id, "tenantId", "entityId", details, "createdAt"
    FROM "AuditLog"
    WHERE action = 'ORDER_DELETED'
    ORDER BY "createdAt" ASC
  `);

  const candidates = deletedLogs
    .map((row) => {
      const details = parseDetails(row.details);
      const code = details?.code;
      const totalAmount = Number(details?.totalAmount ?? 0);
      if (!code || !Number.isFinite(totalAmount)) {
        return null;
      }
      return {
        auditId: row.id,
        tenantId: row.tenantId,
        orderId: row.entityId,
        code,
        totalAmount,
        deletedAt: row.createdAt,
      };
    })
    .filter(Boolean);

  let restored = 0;
  let skippedAlreadyExists = 0;
  const skippedInvalid = deletedLogs.length - candidates.length;

  console.log(`Deleted logs: ${deletedLogs.length}`);
  console.log(`Restorable logs: ${candidates.length}`);
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`);

  for (const entry of candidates) {
    const alreadyExists = await sql.query(`
      SELECT id
      FROM "Order"
      WHERE id = $1
      LIMIT 1
    `, [entry.orderId]);

    if (alreadyExists.length > 0) {
      skippedAlreadyExists += 1;
      continue;
    }

    if (!APPLY) {
      continue;
    }

    const customerId = await ensureFallbackCustomer(entry.tenantId);
    const restoredCode = await resolveOrderCode(entry.tenantId, entry.code);

    await sql.query(`
      INSERT INTO "Order" (
        "id", "tenantId", "code", "customerId", "status", "totalAmount",
        "discountAmount", "discountReason", "paidAmount", "notes", "promisedAt", "createdAt", "updatedAt"
      )
      VALUES (
        $1, $2, $3, $4, 'RECU', $5,
        0, NULL, 0, $6, NULL, $7, NOW()
      )
    `, [
      entry.orderId,
      entry.tenantId,
      restoredCode,
      customerId,
      entry.totalAmount,
      `Commande restaurée depuis AuditLog ORDER_DELETED (audit:${entry.auditId})`,
      entry.deletedAt,
    ]);

    await sql.query(`
      INSERT INTO "OrderStatusHistory" (
        "id", "orderId", "fromStatus", "toStatus", "changedBy", "note", "createdAt"
      )
      VALUES (
        $1, $2, NULL, 'RECU', NULL, $3, NOW()
      )
    `, [
      `restore-status-${entry.orderId}`,
      entry.orderId,
      'Restauration automatique depuis AuditLog',
    ]);

    await sql.query(`
      INSERT INTO "AuditLog" (
        "id", "tenantId", "userId", "action", "entity", "entityId", "details", "createdAt"
      )
      VALUES (
        $1, $2, NULL, 'ORDER_RESTORED', 'Order', $3, $4, NOW()
      )
    `, [
      `restore-audit-${entry.orderId}`,
      entry.tenantId,
      entry.orderId,
      JSON.stringify({ restoredFromDeletedAudit: true, originalCode: entry.code, restoredCode }),
    ]);

    restored += 1;
  }

  console.log('Summary:');
  console.log(`- Restored: ${restored}`);
  console.log(`- Skipped (already exists): ${skippedAlreadyExists}`);
  console.log(`- Skipped (invalid details): ${skippedInvalid}`);
}

main().catch((error) => {
  console.error('Restore failed:', error?.message ?? error);
  process.exit(1);
});
