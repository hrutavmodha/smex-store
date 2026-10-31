ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "winner_name" varchar(100);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "runner_up_name" varchar(100);--> statement-breakpoint
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "mvp_name" varchar(100);
