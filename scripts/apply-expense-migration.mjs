import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(dbUrl);

async function run() {
  console.log("Applying Expense migration to Neon PostgreSQL...");

  await sql.query(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseCategory') THEN
        CREATE TYPE "ExpenseCategory" AS ENUM ('PRODUITS', 'LIVRAISON', 'MATERIEL', 'CHARGES_FIXES', 'SALAIRES', 'AUTRE');
      END IF;
    END $$;
  `);

  await sql.query(`
    CREATE TABLE IF NOT EXISTS "Expense" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "category" "ExpenseCategory" NOT NULL DEFAULT 'AUTRE',
      "description" TEXT NOT NULL,
      "amount" INTEGER NOT NULL,
      "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
      "supplier" TEXT,
      "receiptUrl" TEXT,
      "notes" TEXT,
      "createdBy" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
    );
  `);

  await sql.query(`CREATE INDEX IF NOT EXISTS "Expense_tenantId_idx" ON "Expense"("tenantId");`);
  await sql.query(`CREATE INDEX IF NOT EXISTS "Expense_tenantId_date_idx" ON "Expense"("tenantId", "date");`);
  await sql.query(`CREATE INDEX IF NOT EXISTS "Expense_tenantId_category_idx" ON "Expense"("tenantId", "category");`);

  await sql.query(`
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Expense_tenantId_fkey'
      ) THEN
        ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
      END IF;
    END $$;
  `);

  console.log("✅ Expense migration successfully applied to Neon PostgreSQL!");
}

run().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
