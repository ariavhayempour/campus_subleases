CREATE TYPE "public"."room_type" AS ENUM('single', 'shared');--> statement-breakpoint
ALTER TABLE "listings" DROP CONSTRAINT "listings_private_bathroom_room_only";--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "room_type" "room_type" DEFAULT 'single' NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "room_features" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
-- backfill
UPDATE "listings" SET "type" = 'apartment' WHERE "type" = 'room';--> statement-breakpoint
UPDATE "listings" SET "private_bathroom" = NULL WHERE "roommates_count" = 0;--> statement-breakpoint
UPDATE "listings" SET "private_bathroom" = false WHERE "roommates_count" > 0 AND "private_bathroom" IS NULL;
