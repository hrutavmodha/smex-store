ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'manager';
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "promoted_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "promoted_at" timestamp with time zone;
