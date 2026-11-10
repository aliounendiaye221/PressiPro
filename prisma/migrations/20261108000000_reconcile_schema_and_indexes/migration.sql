-- Migration idempotente de réconciliation complète entre prisma/migrations et prisma/schema.prisma.
-- 100% sûre sur la base Neon déjà en production (colonnes/tables créées hors Prisma Migrate)
-- ainsi que sur toute nouvelle base PostgreSQL vierge.

-- 1. Enums manquants ou étendus
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

DO $$
BEGIN
  CREATE TYPE "PricingType" AS ENUM ('PER_ITEM', 'PER_KG');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Colonnes dérivées sur Tenant
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "brandPrimaryColor" TEXT,
  ADD COLUMN IF NOT EXISTS "brandAccentColor" TEXT,
  ADD COLUMN IF NOT EXISTS "waveNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "omNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "cinetpaySiteId" TEXT,
  ADD COLUMN IF NOT EXISTS "cinetpayApiKey" TEXT,
  ADD COLUMN IF NOT EXISTS "cinetpaySecretKey" TEXT,
  ADD COLUMN IF NOT EXISTS "cinetpayEnabled" BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS "subscription" TEXT DEFAULT 'FREE',
  ADD COLUMN IF NOT EXISTS "subscribedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP(3);

UPDATE "Tenant" SET "cinetpayEnabled" = false WHERE "cinetpayEnabled" IS NULL;
UPDATE "Tenant" SET "active" = true WHERE "active" IS NULL;
UPDATE "Tenant" SET "subscription" = 'FREE' WHERE "subscription" IS NULL;

ALTER TABLE "Tenant"
  ALTER COLUMN "cinetpayEnabled" SET DEFAULT false,
  ALTER COLUMN "cinetpayEnabled" SET NOT NULL,
  ALTER COLUMN "active" SET DEFAULT true,
  ALTER COLUMN "active" SET NOT NULL,
  ALTER COLUMN "subscription" SET DEFAULT 'FREE',
  ALTER COLUMN "subscription" SET NOT NULL;

-- 3. Colonnes dérivées sur Service et OrderItem
ALTER TABLE "Service"
  ADD COLUMN IF NOT EXISTS "pricingType" "PricingType" NOT NULL DEFAULT 'PER_ITEM';

ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "weight" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "pricingType" "PricingType" NOT NULL DEFAULT 'PER_ITEM';

-- 4. Table SubscriptionPayment
CREATE TABLE IF NOT EXISTS "SubscriptionPayment" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "transactionId" TEXT NOT NULL,
  "paymentMethod" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "operatorId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPayment_transactionId_key" ON "SubscriptionPayment"("transactionId");
CREATE INDEX IF NOT EXISTS "SubscriptionPayment_tenantId_idx" ON "SubscriptionPayment"("tenantId");

-- 5. Protection comptable : ON DELETE RESTRICT sur Payment.orderId et SubscriptionPayment.tenantId
ALTER TABLE "SubscriptionPayment" DROP CONSTRAINT IF EXISTS "SubscriptionPayment_tenantId_fkey";
ALTER TABLE "SubscriptionPayment"
  ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_orderId_fkey";
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 6. Index composites manquants et optimisations de requêtes multi-tenant
CREATE INDEX IF NOT EXISTS "Order_tenantId_status_promisedAt_idx" ON "Order"("tenantId", "status", "promisedAt");
CREATE INDEX IF NOT EXISTS "Order_tenantId_deletedAt_idx" ON "Order"("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "Order_tenantId_deletedAt_createdAt_idx" ON "Order"("tenantId", "deletedAt", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Service_tenantId_active_name_idx" ON "Service"("tenantId", "active", "name");
CREATE INDEX IF NOT EXISTS "Payment_tenantId_method_idx" ON "Payment"("tenantId", "method");

-- 7. Nettoyage des index strictement redondants (couverts par les contraintes UNIQUE ou préfixes composites)
DROP INDEX IF EXISTS "Customer_tenantId_phone_idx";
DROP INDEX IF EXISTS "Order_tenantId_code_idx";
DROP INDEX IF EXISTS "User_tenantId_idx";
DROP INDEX IF EXISTS "Customer_tenantId_idx";
DROP INDEX IF EXISTS "Service_tenantId_idx";
DROP INDEX IF EXISTS "Order_tenantId_idx";
DROP INDEX IF EXISTS "Payment_tenantId_idx";
DROP INDEX IF EXISTS "AuditLog_tenantId_idx";
DROP INDEX IF EXISTS "Expense_tenantId_idx";
