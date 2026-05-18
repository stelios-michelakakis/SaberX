CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filename" varchar(320) NOT NULL,
	"mime_type" varchar(160) NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"storage_path" varchar(320) NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"uploaded_by" uuid,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "cell_value_links_source_target_ordinal_unique";--> statement-breakpoint
ALTER TABLE "cell_value_links" ALTER COLUMN "target_row_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cell_value_links" ADD COLUMN "target_source_id" uuid;--> statement-breakpoint
ALTER TABLE "reference_bindings" ADD COLUMN "allow_sources" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sources_sha256_unique" ON "sources" USING btree ("sha256");--> statement-breakpoint
CREATE INDEX "sources_filename_idx" ON "sources" USING btree ("filename");--> statement-breakpoint
CREATE INDEX "sources_uploaded_by_idx" ON "sources" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "sources_deleted_at_idx" ON "sources" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "cell_value_links" ADD CONSTRAINT "cell_value_links_target_source_id_sources_id_fk" FOREIGN KEY ("target_source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cell_value_links_target_source_idx" ON "cell_value_links" USING btree ("target_source_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cell_value_links_source_target_source_ordinal_unique" ON "cell_value_links" USING btree ("source_row_id","source_field_id","target_source_id","ordinal") WHERE "cell_value_links"."target_source_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "cell_value_links_source_target_ordinal_unique" ON "cell_value_links" USING btree ("source_row_id","source_field_id","target_row_id","ordinal") WHERE "cell_value_links"."target_row_id" is not null;