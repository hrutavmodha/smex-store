ALTER TABLE "boosting_orders" ALTER COLUMN "contact_channel" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."boosting_contact_channel";--> statement-breakpoint
CREATE TYPE "public"."boosting_contact_channel" AS ENUM('whatsapp', 'instagram');--> statement-breakpoint
ALTER TABLE "boosting_orders" ALTER COLUMN "contact_channel" SET DATA TYPE "public"."boosting_contact_channel" USING "contact_channel"::"public"."boosting_contact_channel";