DO $$ BEGIN
	CREATE TYPE "public"."login_status" AS ENUM('success', 'failed');
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "login_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"device_name" varchar(150),
	"status" "login_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "login_history" ADD CONSTRAINT "login_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
	WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_username_trgm_idx" ON "profiles" USING gin ("username" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_in_game_id_trgm_idx" ON "profiles" USING gin ("in_game_id" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_name_trgm_idx" ON "teams" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournaments_title_trgm_idx" ON "tournaments" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_title_trgm_idx" ON "marketplace_listings" USING gin ("title" gin_trgm_ops);
