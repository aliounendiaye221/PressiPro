-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "brandPrimaryColor" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "brandAccentColor" TEXT;
