-- Add loyalty discount columns to orders.
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "discountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "discountReason" TEXT;
