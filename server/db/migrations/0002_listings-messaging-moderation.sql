CREATE TYPE "public"."admin_action" AS ENUM('approved_listing', 'rejected_listing', 'hid_listing', 'auto_hid_listing', 'unhid_listing', 'deleted_listing', 'resolved_report', 'banned_user', 'unbanned_user', 'viewed_conversation');--> statement-breakpoint
CREATE TYPE "public"."gender_preference" AS ENUM('any', 'women', 'men', 'nonbinary_friendly');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('active', 'taken', 'removed');--> statement-breakpoint
CREATE TYPE "public"."listing_type" AS ENUM('apartment', 'house', 'room');--> statement-breakpoint
CREATE TYPE "public"."report_reason" AS ENUM('scam', 'spam', 'inappropriate', 'harassment', 'other');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('open', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."report_target_type" AS ENUM('user', 'listing', 'message');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected', 'hidden');--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" text NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_listing_id_pk" PRIMARY KEY("user_id","listing_id")
);
--> statement-breakpoint
ALTER TABLE "favorites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"position" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listing_photos_position_range" CHECK ("listing_photos"."position" between 0 and 9)
);
--> statement-breakpoint
ALTER TABLE "listing_photos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"owner_id" text NOT NULL,
	"type" "listing_type" NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"rent_cents" integer NOT NULL,
	"available_from" date NOT NULL,
	"available_to" date NOT NULL,
	"bedrooms" smallint NOT NULL,
	"bathrooms" numeric(3, 1) NOT NULL,
	"roommates_count" smallint DEFAULT 0 NOT NULL,
	"private_bathroom" boolean,
	"gender_preference" "gender_preference" DEFAULT 'any' NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"zip" text NOT NULL,
	"unit" text,
	"location" geography(Point, 4326) NOT NULL,
	"furnished" boolean DEFAULT false NOT NULL,
	"amenities" text[] DEFAULT '{}'::text[] NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("title", '')), 'A') || setweight(to_tsvector('english', coalesce("description", '')), 'B') || setweight(to_tsvector('english', coalesce("address", '')), 'C')) STORED,
	"status" "listing_status" DEFAULT 'active' NOT NULL,
	"taken_at" timestamp with time zone,
	"review_status" "review_status" DEFAULT 'pending' NOT NULL,
	"review_note" text,
	"reviewed_by" text,
	"reviewed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_rent_range" CHECK ("listings"."rent_cents" between 100 and 1000000),
	CONSTRAINT "listings_dates_order" CHECK ("listings"."available_to" > "listings"."available_from"),
	CONSTRAINT "listings_bedrooms_nonnegative" CHECK ("listings"."bedrooms" >= 0),
	CONSTRAINT "listings_roommates_range" CHECK ("listings"."roommates_count" between 0 and 10),
	CONSTRAINT "listings_private_bathroom_room_only" CHECK (("listings"."type" = 'room') = ("listings"."private_bathroom" is not null)),
	CONSTRAINT "listings_rejection_has_note" CHECK ("listings"."review_status" <> 'rejected' or "listings"."review_note" is not null)
);
--> statement-breakpoint
ALTER TABLE "listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id"),
	CONSTRAINT "blocks_not_self" CHECK ("blocks"."blocker_id" <> "blocks"."blocked_id")
);
--> statement-breakpoint
ALTER TABLE "blocks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid,
	"host_id" text,
	"renter_id" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"host_last_read_at" timestamp with time zone,
	"renter_last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_listing_renter" UNIQUE("listing_id","renter_id")
);
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" text,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_body_length" CHECK (char_length("messages"."body") between 1 and 2000)
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" text,
	"action" "admin_action" NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "admin_audit_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" text,
	"target_type" "report_target_type" NOT NULL,
	"target_id" text NOT NULL,
	"reason" "report_reason" NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_details_length" CHECK (char_length("reports"."details") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "reports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_renter_id_users_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "favorites_listing" ON "favorites" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "listing_photos_listing" ON "listing_photos" USING btree ("listing_id","position");--> statement-breakpoint
CREATE INDEX "listings_location_gist" ON "listings" USING gist ("location");--> statement-breakpoint
CREATE INDEX "listings_search_gin" ON "listings" USING gin ("search_vector");--> statement-breakpoint
CREATE INDEX "listings_browse_rent" ON "listings" USING btree ("school_id","status","review_status","rent_cents");--> statement-breakpoint
CREATE INDEX "listings_browse_available" ON "listings" USING btree ("school_id","status","review_status","available_from");--> statement-breakpoint
CREATE INDEX "listings_owner" ON "listings" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "listings_review_queue" ON "listings" USING btree ("review_status","created_at");--> statement-breakpoint
CREATE INDEX "blocks_blocked" ON "blocks" USING btree ("blocked_id");--> statement-breakpoint
CREATE INDEX "conversations_host_inbox" ON "conversations" USING btree ("host_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_renter_inbox" ON "conversations" USING btree ("renter_id","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_conversation" ON "messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "messages_sender_rate" ON "messages" USING btree ("sender_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_log_created" ON "admin_audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "reports_queue" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "reports_target" ON "reports" USING btree ("target_type","target_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_open_unique" ON "reports" USING btree ("reporter_id","target_type","target_id") WHERE "reports"."status" = 'open';