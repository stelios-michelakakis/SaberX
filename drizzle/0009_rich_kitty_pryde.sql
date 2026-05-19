DROP INDEX "sources_sha256_unique";--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "display_name" varchar(320);--> statement-breakpoint
CREATE INDEX "sources_display_name_idx" ON "sources" USING btree ("display_name");--> statement-breakpoint
CREATE UNIQUE INDEX "sources_sha256_unique" ON "sources" USING btree ("sha256") WHERE "sources"."deleted_at" IS NULL;