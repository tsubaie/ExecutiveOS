CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'inbox' NOT NULL,
	"priority" text,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"owner_id" uuid,
	"parent_id" uuid,
	"sort_order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_op_id" uuid,
	"search_text" text GENERATED ALWAYS AS (eos_normalize(title || ' ' || coalesce(description, ''))) STORED,
	CONSTRAINT "tasks_title_check" CHECK (length(trim("tasks"."title")) between 1 and 500),
	CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" in ('inbox','next_action','waiting_on','someday','completed')),
	CONSTRAINT "tasks_priority_check" CHECK ("tasks"."priority" in ('low','medium','high','urgent')),
	CONSTRAINT "tasks_completed_check" CHECK (("tasks"."status" = 'completed') = ("tasks"."completed_at" is not null)),
	CONSTRAINT "tasks_self_check" CHECK ("tasks"."parent_id" <> "tasks"."id")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_owner_id_people_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parent_id_tasks_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_owner_idx" ON "tasks" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "tasks_creator_idx" ON "tasks" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "tasks_updater_idx" ON "tasks" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "tasks_due_idx" ON "tasks" USING btree ("due_date","id");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status","deleted_at");--> statement-breakpoint
CREATE INDEX "tasks_search_idx" ON "tasks" USING gin ("search_text" gin_trgm_ops);