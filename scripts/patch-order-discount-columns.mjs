import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('Applying Order discount columns patch...');

  await sql.query('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER NOT NULL DEFAULT 0');
  await sql.query('ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "discountReason" TEXT');

  const result = await sql.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Order'
      AND column_name IN ('discountAmount', 'discountReason')
    ORDER BY column_name
  `);

  const rows = Array.isArray(result)
    ? result
    : Array.isArray(result?.rows)
      ? result.rows
      : [];

  console.log('Columns present:', rows.map((r) => r.column_name).join(', '));
  console.log('Patch complete.');
}

main().catch((error) => {
  console.error('Patch failed:', error?.message ?? error);
  process.exit(1);
});
