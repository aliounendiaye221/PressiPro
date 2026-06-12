import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  const tenants = await sql.query(`
    SELECT id, name, "createdAt"
    FROM "Tenant"
    ORDER BY name ASC
  `);

  const report = [];

  for (const tenant of tenants) {
    const tenantId = tenant.id;

    const [
      users,
      customers,
      services,
      orders,
      orderItems,
      payments,
      deletedLogs,
      unresolvedDeletedLogs,
      restoredOrders,
      ordersWithoutItems,
      orderTotalMismatch,
      paidAmountMismatch,
      duplicateCodes,
      lastOrder,
    ] = await Promise.all([
      sql.query(`SELECT COUNT(*)::int AS count FROM "User" WHERE "tenantId" = $1`, [tenantId]),
      sql.query(`SELECT COUNT(*)::int AS count FROM "Customer" WHERE "tenantId" = $1`, [tenantId]),
      sql.query(`SELECT COUNT(*)::int AS count FROM "Service" WHERE "tenantId" = $1`, [tenantId]),
      sql.query(`SELECT COUNT(*)::int AS count FROM "Order" WHERE "tenantId" = $1`, [tenantId]),
      sql.query(`
        SELECT COUNT(*)::int AS count
        FROM "OrderItem" oi
        JOIN "Order" o ON o.id = oi."orderId"
        WHERE o."tenantId" = $1
      `, [tenantId]),
      sql.query(`
        SELECT COUNT(*)::int AS count
        FROM "Payment" p
        JOIN "Order" o ON o.id = p."orderId"
        WHERE o."tenantId" = $1
      `, [tenantId]),
      sql.query(`
        SELECT COUNT(*)::int AS count
        FROM "AuditLog"
        WHERE "tenantId" = $1 AND action = 'ORDER_DELETED'
      `, [tenantId]),
      sql.query(`
        SELECT COUNT(*)::int AS count
        FROM "AuditLog" a
        WHERE a."tenantId" = $1
          AND a.action = 'ORDER_DELETED'
          AND NOT EXISTS (
            SELECT 1 FROM "Order" o WHERE o.id = a."entityId"
          )
      `, [tenantId]),
      sql.query(`
        SELECT COUNT(*)::int AS count
        FROM "Order"
        WHERE "tenantId" = $1
          AND notes LIKE 'Commande restaurée depuis AuditLog%'
      `, [tenantId]),
      sql.query(`
        SELECT COUNT(*)::int AS count
        FROM "Order" o
        WHERE o."tenantId" = $1
          AND NOT EXISTS (
            SELECT 1 FROM "OrderItem" oi WHERE oi."orderId" = o.id
          )
      `, [tenantId]),
      sql.query(`
        SELECT COUNT(*)::int AS count
        FROM "Order" o
        LEFT JOIN (
          SELECT "orderId", COALESCE(SUM(total), 0)::int AS "itemsTotal"
          FROM "OrderItem"
          GROUP BY "orderId"
        ) it ON it."orderId" = o.id
        WHERE o."tenantId" = $1
          AND (COALESCE(it."itemsTotal", 0) - COALESCE(o."discountAmount", 0)) <> o."totalAmount"
      `, [tenantId]),
      sql.query(`
        SELECT COUNT(*)::int AS count
        FROM "Order" o
        LEFT JOIN (
          SELECT "orderId", COALESCE(SUM(amount), 0)::int AS "paid"
          FROM "Payment"
          GROUP BY "orderId"
        ) p ON p."orderId" = o.id
        WHERE o."tenantId" = $1
          AND COALESCE(p."paid", 0) <> o."paidAmount"
      `, [tenantId]),
      sql.query(`
        SELECT COUNT(*)::int AS count
        FROM (
          SELECT code
          FROM "Order"
          WHERE "tenantId" = $1
          GROUP BY code
          HAVING COUNT(*) > 1
        ) dup
      `, [tenantId]),
      sql.query(`
        SELECT MAX("createdAt") AS "lastCreatedAt"
        FROM "Order"
        WHERE "tenantId" = $1
      `, [tenantId]),
    ]);

    report.push({
      tenantId,
      tenantName: tenant.name,
      users: users[0]?.count ?? 0,
      customers: customers[0]?.count ?? 0,
      services: services[0]?.count ?? 0,
      orders: orders[0]?.count ?? 0,
      orderItems: orderItems[0]?.count ?? 0,
      payments: payments[0]?.count ?? 0,
      deletedLogs: deletedLogs[0]?.count ?? 0,
      unresolvedDeletedLogs: unresolvedDeletedLogs[0]?.count ?? 0,
      restoredOrders: restoredOrders[0]?.count ?? 0,
      ordersWithoutItems: ordersWithoutItems[0]?.count ?? 0,
      orderTotalMismatch: orderTotalMismatch[0]?.count ?? 0,
      paidAmountMismatch: paidAmountMismatch[0]?.count ?? 0,
      duplicateCodes: duplicateCodes[0]?.count ?? 0,
      lastOrderCreatedAt: lastOrder[0]?.lastCreatedAt ?? null,
    });
  }

  const global = report.reduce(
    (acc, item) => {
      acc.tenants += 1;
      acc.orders += item.orders;
      acc.orderItems += item.orderItems;
      acc.payments += item.payments;
      acc.unresolvedDeletedLogs += item.unresolvedDeletedLogs;
      acc.ordersWithoutItems += item.ordersWithoutItems;
      acc.orderTotalMismatch += item.orderTotalMismatch;
      acc.paidAmountMismatch += item.paidAmountMismatch;
      acc.duplicateCodes += item.duplicateCodes;
      return acc;
    },
    {
      tenants: 0,
      orders: 0,
      orderItems: 0,
      payments: 0,
      unresolvedDeletedLogs: 0,
      ordersWithoutItems: 0,
      orderTotalMismatch: 0,
      paidAmountMismatch: 0,
      duplicateCodes: 0,
    }
  );

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), global, report }, null, 2));
}

main().catch((error) => {
  console.error('Integrity check failed:', error?.message ?? error);
  process.exit(1);
});
