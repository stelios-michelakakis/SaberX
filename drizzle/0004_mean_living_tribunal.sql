CREATE TABLE "chat_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"kind" varchar(20) NOT NULL,
	"offset" integer NOT NULL,
	"length" integer NOT NULL,
	"target_user_id" uuid,
	"target_document_id" uuid,
	"target_sheet_id" uuid,
	"target_row_id" uuid,
	"target_field_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"body" text NOT NULL,
	"edited_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_mentions" ADD CONSTRAINT "chat_mentions_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mentions" ADD CONSTRAINT "chat_mentions_target_user_id_users_id_fk" FOREIGN KEY ("target_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mentions" ADD CONSTRAINT "chat_mentions_target_document_id_documents_id_fk" FOREIGN KEY ("target_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mentions" ADD CONSTRAINT "chat_mentions_target_sheet_id_sheets_id_fk" FOREIGN KEY ("target_sheet_id") REFERENCES "public"."sheets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mentions" ADD CONSTRAINT "chat_mentions_target_row_id_rows_id_fk" FOREIGN KEY ("target_row_id") REFERENCES "public"."rows"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_mentions" ADD CONSTRAINT "chat_mentions_target_field_id_fields_id_fk" FOREIGN KEY ("target_field_id") REFERENCES "public"."fields"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_mentions_message_id_idx" ON "chat_mentions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "chat_mentions_target_user_id_idx" ON "chat_mentions" USING btree ("target_user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_document_id_idx" ON "chat_messages" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "chat_messages_document_created_idx" ON "chat_messages" USING btree ("document_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_messages_author_id_idx" ON "chat_messages" USING btree ("author_id");