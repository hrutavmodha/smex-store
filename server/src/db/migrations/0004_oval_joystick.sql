ALTER TABLE "marketplace_listings" ALTER COLUMN "contact_channel" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."contact_channel";--> statement-breakpoint
CREATE TYPE "public"."contact_channel" AS ENUM('whatsapp', 'instagram');--> statement-breakpoint
ALTER TABLE "marketplace_listings" ALTER COLUMN "contact_channel" SET DATA TYPE "public"."contact_channel" USING "contact_channel"::"public"."contact_channel";