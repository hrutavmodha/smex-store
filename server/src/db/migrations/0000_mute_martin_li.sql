CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."density_preference" AS ENUM('compact', 'comfortable', 'spacious');--> statement-breakpoint
CREATE TYPE "public"."privacy_preference" AS ENUM('public', 'friends', 'private');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('dark', 'amoled', 'light');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."team_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'live', 'completed', 'bye');--> statement-breakpoint
CREATE TYPE "public"."tournament_format" AS ENUM('single_elimination', 'double_elimination', 'round_robin');--> statement-breakpoint
CREATE TYPE "public"."tournament_status" AS ENUM('upcoming', 'registration_open', 'ongoing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."boosting_contact_channel" AS ENUM('whatsapp', 'telegram', 'discord');--> statement-breakpoint
CREATE TYPE "public"."boosting_order_status" AS ENUM('inquiry', 'confirmed', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."boosting_pricing_mode" AS ENUM('fixed_tier', 'per_star');--> statement-breakpoint
CREATE TYPE "public"."contact_channel" AS ENUM('whatsapp', 'telegram', 'discord', 'phone');--> statement-breakpoint
CREATE TYPE "public"."listing_badge" AS ENUM('none', 'good_deal', 'hot');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'sold', 'deleted');--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" varchar(50) NOT NULL,
	"in_game_id" varchar(50),
	"avatar_preset" varchar(50) DEFAULT 'preset_default_01' NOT NULL,
	"playstyle" varchar(50),
	"bio" text,
	"theme_pref" "theme_preference" DEFAULT 'dark' NOT NULL,
	"density_pref" "density_preference" DEFAULT 'comfortable' NOT NULL,
	"activity_privacy" "privacy_preference" DEFAULT 'public' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique_idx" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique_idx" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"refresh_token_hash" text NOT NULL,
	"device_fingerprint" varchar(128),
	"device_name" varchar(150) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"member_role" varchar(50) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_members_team_user_unq" UNIQUE("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"tag" varchar(10) NOT NULL,
	"captain_id" uuid NOT NULL,
	"game_slug" varchar(50) DEFAULT 'mlbb' NOT NULL,
	"member_cap" integer DEFAULT 5 NOT NULL,
	"status" "team_status" DEFAULT 'open' NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "teams_name_unique_idx" UNIQUE("name"),
	CONSTRAINT "teams_member_cap_chk" CHECK ("teams"."member_cap" >= 1 AND "teams"."member_cap" <= 10)
);
--> statement-breakpoint
CREATE TABLE "tournament_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"match_order" integer NOT NULL,
	"team_a_id" uuid,
	"team_b_id" uuid,
	"team_a_score" integer DEFAULT 0 NOT NULL,
	"team_b_score" integer DEFAULT 0 NOT NULL,
	"winner_id" uuid,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tournament_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"seed" integer,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournament_participants_unq" UNIQUE("tournament_id","team_id")
);
--> statement-breakpoint
CREATE TABLE "tournaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(100) NOT NULL,
	"game_slug" varchar(50) DEFAULT 'mlbb' NOT NULL,
	"format" "tournament_format" DEFAULT 'single_elimination' NOT NULL,
	"status" "tournament_status" DEFAULT 'upcoming' NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"prize_pool_inr" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"max_teams" integer DEFAULT 16 NOT NULL,
	"rules_markdown" text,
	"winner_team_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tournaments_max_teams_chk" CHECK ("tournaments"."max_teams" >= 2 AND "tournaments"."max_teams" <= 128)
);
--> statement-breakpoint
CREATE TABLE "boosting_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid,
	"game_slug" varchar(50) DEFAULT 'mlbb' NOT NULL,
	"pricing_mode" "boosting_pricing_mode" NOT NULL,
	"starting_rank" varchar(50) NOT NULL,
	"target_rank" varchar(50) NOT NULL,
	"starting_stars" integer DEFAULT 0 NOT NULL,
	"target_stars" integer DEFAULT 0 NOT NULL,
	"calculated_price_inr" numeric(10, 2) NOT NULL,
	"customer_ign" varchar(50) NOT NULL,
	"contact_channel" "boosting_contact_channel" NOT NULL,
	"status" "boosting_order_status" DEFAULT 'inquiry' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "boosting_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_slug" varchar(50) DEFAULT 'mlbb' NOT NULL,
	"pricing_mode" "boosting_pricing_mode" NOT NULL,
	"from_tier" varchar(50),
	"to_tier" varchar(50),
	"star_tier" varchar(50),
	"min_stars" integer,
	"max_stars" integer,
	"price_inr" numeric(10, 2) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "boosting_rates_price_positive_chk" CHECK ("boosting_rates"."price_inr" > 0)
);
--> statement-breakpoint
CREATE TABLE "listing_proofs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"cdn_url" text NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"title" varchar(150) NOT NULL,
	"game_slug" varchar(50) DEFAULT 'mlbb' NOT NULL,
	"rank_tier" varchar(50) NOT NULL,
	"price_inr" numeric(10, 2) NOT NULL,
	"baseline_price_inr" numeric(10, 2),
	"badge_type" "listing_badge" DEFAULT 'none' NOT NULL,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"contact_channel" "contact_channel" NOT NULL,
	"contact_handle" varchar(100) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_price_floor_chk" CHECK ("marketplace_listings"."price_inr" >= 100)
);
--> statement-breakpoint
CREATE TABLE "seller_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"rating" integer NOT NULL,
	"review_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_ratings_buyer_listing_unq" UNIQUE("buyer_id","listing_id"),
	CONSTRAINT "seller_ratings_range_chk" CHECK ("seller_ratings"."rating" >= 1 AND "seller_ratings"."rating" <= 5),
	CONSTRAINT "seller_ratings_no_self_review_chk" CHECK ("seller_ratings"."seller_id" <> "seller_ratings"."buyer_id")
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"action_type" varchar(50) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teams" ADD CONSTRAINT "teams_captain_id_users_id_fk" FOREIGN KEY ("captain_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_team_a_id_teams_id_fk" FOREIGN KEY ("team_a_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_team_b_id_teams_id_fk" FOREIGN KEY ("team_b_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winner_id_teams_id_fk" FOREIGN KEY ("winner_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_tournament_id_tournaments_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament_participants" ADD CONSTRAINT "tournament_participants_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_winner_team_id_teams_id_fk" FOREIGN KEY ("winner_team_id") REFERENCES "public"."teams"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "boosting_orders" ADD CONSTRAINT "boosting_orders_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_proofs" ADD CONSTRAINT "listing_proofs_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_ratings" ADD CONSTRAINT "seller_ratings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_ratings" ADD CONSTRAINT "seller_ratings_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_ratings" ADD CONSTRAINT "seller_ratings_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_active_idx" ON "sessions" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "tournament_matches_round_idx" ON "tournament_matches" USING btree ("tournament_id","round_number");--> statement-breakpoint
CREATE INDEX "boosting_rates_mode_idx" ON "boosting_rates" USING btree ("pricing_mode","is_active");--> statement-breakpoint
CREATE INDEX "seller_ratings_seller_idx" ON "seller_ratings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "activity_logs_user_created_idx" ON "activity_logs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournaments_title_trgm_idx" ON "tournaments" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "teams_name_trgm_idx" ON "teams" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_username_trgm_idx" ON "profiles" USING gin ("username" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "profiles_in_game_id_trgm_idx" ON "profiles" USING gin ("in_game_id" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketplace_title_trgm_idx" ON "marketplace_listings" USING gin ("title" gin_trgm_ops);