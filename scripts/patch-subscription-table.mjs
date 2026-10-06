import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('Applying Subscription patch to Neon PostgreSQL...');

  // 1. Add subscriptionExpiresAt to Tenant
  await sql.query('ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP(3)');

  // 2. Create SubscriptionPayment table
  await sql.query(`
    CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
      "id" TEXT PRIMARY KEY,
      "tenantId" TEXT NOT NULL,
      "plan" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "transactionId" TEXT NOT NULL UNIQUE,
      "paymentMethod" TEXT,
      "status" TEXT NOT NULL DEFAULT 'PENDING',
      "operatorId" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `);

  await sql.query(`
    CREATE INDEX IF NOT EXISTS "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId")
  `);

  console.log('✅ Subscription table & columns patch complete.');
}

main().catch((error) => {
  console.error('Patch failed:', error?.message ?? error);
  process.exit(1);
});
