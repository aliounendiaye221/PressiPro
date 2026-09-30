-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('PRODUITS', 'LIVRAISON', 'MATERIEL', 'CHARGES_FIXES', 'SALAIRES', 'AUTRE');

-- CreateTable
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Expense_tenantId_idx" ON "Expense"("tenantId");
CREATE INDEX IF NOT EXISTS "Expense_tenantId_date_idx" ON "Expense"("tenantId", "date");
CREATE INDEX IF NOT EXISTS "Expense_tenantId_category_idx" ON "Expense"("tenantId", "category");

-- AddForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_tenantId_fkey";
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
