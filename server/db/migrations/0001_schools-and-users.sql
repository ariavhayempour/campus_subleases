CREATE TYPE "public"."user_status" AS ENUM('active', 'banned');--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"campus_location" geography(Point, 4326) NOT NULL,
	"default_map_zoom" smallint NOT NULL,
	"timezone" text NOT NULL,
	"warn_radius_km" smallint DEFAULT 25 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "schools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "schools" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"home_school_id" uuid,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_home_school_id_schools_id_fk" FOREIGN KEY ("home_school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;