CREATE TABLE "committees" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"ownership" text DEFAULT '' NOT NULL,
	"scope" text DEFAULT 'internal' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_op_id" uuid,
	"search_text" text GENERATED ALWAYS AS (eos_normalize(name || ' ' || description || ' ' || ownership)) STORED,
	CONSTRAINT "committees_name_check" CHECK (length(trim("committees"."name")) between 1 and 500),
	CONSTRAINT "committees_scope_check" CHECK ("committees"."scope" in ('internal','external')),
	CONSTRAINT "committees_status_check" CHECK ("committees"."status" in ('active','archived')),
	CONSTRAINT "committees_order_check" CHECK ("committees"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "committee_id" uuid;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "committee_id" uuid;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "committees" ADD CONSTRAINT "committees_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "committees_name_unique" ON "committees" USING btree (lower("name")) WHERE "committees"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "committees_creator_idx" ON "committees" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "committees_updater_idx" ON "committees" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "committees_search_idx" ON "committees" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "committees_status_idx" ON "committees" USING btree ("status","deleted_at");--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_committee_id_committees_id_fk" FOREIGN KEY ("committee_id") REFERENCES "public"."committees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notes_committee_idx" ON "notes" USING btree ("committee_id");--> statement-breakpoint
CREATE INDEX "tasks_committee_idx" ON "tasks" USING btree ("committee_id");