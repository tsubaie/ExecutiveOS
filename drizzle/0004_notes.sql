CREATE TABLE "note_people" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_op_id" uuid
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"type" text NOT NULL,
	"note_date" date NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_op_id" uuid,
	"search_text" text GENERATED ALWAYS AS (eos_normalize(title || ' ' || content)) STORED,
	CONSTRAINT "notes_title_check" CHECK (length(trim("notes"."title")) between 1 and 500),
	CONSTRAINT "notes_tags_check" CHECK (cardinality("notes"."tags") <= 10)
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "source_note_id" uuid;--> statement-breakpoint
ALTER TABLE "note_people" ADD CONSTRAINT "note_people_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_people" ADD CONSTRAINT "note_people_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_people" ADD CONSTRAINT "note_people_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "note_people_active_idx" ON "note_people" USING btree ("note_id","person_id") WHERE "note_people"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "note_people_note_idx" ON "note_people" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "note_people_person_idx" ON "note_people" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "note_people_creator_idx" ON "note_people" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "notes_date_idx" ON "notes" USING btree ("note_date","created_at","id") WHERE "notes"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "notes_type_idx" ON "notes" USING btree ("type");--> statement-breakpoint
CREATE INDEX "notes_archived_idx" ON "notes" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "notes_creator_idx" ON "notes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "notes_updater_idx" ON "notes" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "notes_tags_idx" ON "notes" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "notes_search_idx" ON "notes" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_note_id_notes_id_fk" FOREIGN KEY ("source_note_id") REFERENCES "public"."notes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_source_note_idx" ON "tasks" USING btree ("source_note_id");