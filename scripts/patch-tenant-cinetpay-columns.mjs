import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function main() {
  console.log('Applying Tenant CinetPay columns patch to Neon PostgreSQL...');

  await sql.query('ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "cinetpaySiteId" TEXT');
  await sql.query('ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "cinetpayApiKey" TEXT');
  await sql.query('ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "cinetpaySecretKey" TEXT');
  await sql.query('ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "cinetpayEnabled" BOOLEAN DEFAULT false');

  const result = await sql.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Tenant'
      AND column_name IN ('cinetpaySiteId', 'cinetpayApiKey', 'cinetpaySecretKey', 'cinetpayEnabled')
    ORDER BY column_name
  `);

  const rows = Array.isArray(result)
    ? result
    : Array.isArray(result?.rows)
      ? result.rows
      : [];

  console.log('Columns present:', rows.map((r) => r.column_name).join(', '));
  console.log('✅ Tenant CinetPay columns patch complete.');
}

main().catch((error) => {
  console.error('Patch failed:', error?.message ?? error);
  process.exit(1);
});
