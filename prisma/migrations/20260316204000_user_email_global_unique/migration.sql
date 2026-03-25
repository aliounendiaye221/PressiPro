-- Add global unique constraint for user emails across all tenants.
-- Note: This migration will fail if duplicate emails already exist.
ALTER TABLE "User"
ADD CONSTRAINT "User_email_key" UNIQUE ("email");
