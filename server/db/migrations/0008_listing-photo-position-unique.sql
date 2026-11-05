DROP INDEX "listing_photos_listing";--> statement-breakpoint
CREATE UNIQUE INDEX "listing_photos_listing_position" ON "listing_photos" USING btree ("listing_id","position");