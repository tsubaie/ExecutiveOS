-- TASKS-B02: one completion is one operation, recorded so Undo can put every row it touched back
-- exactly as it was. Generated against the 0013 snapshot, which is the last one drizzle-kit wrote:
-- 0014 and 0015 are custom migrations and left no snapshot, so the generator re-emitted the
-- notifications table it could not see. Those statements are removed here; the 0016 snapshot does
-- describe notifications, so the chain is whole again from this migration on.
CREATE TABLE "task_completion_items" (
	"completion_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"previous_status" text NOT NULL,
	"previous_completed_at" timestamp with time zone,
	"completed_revision" integer NOT NULL,
	CONSTRAINT "task_completion_items_completion_id_task_id_pk" PRIMARY KEY("completion_id","task_id"),
	CONSTRAINT "task_completion_items_status_check" CHECK ("task_completion_items"."previous_status" in ('inbox','next_action','waiting_on','someday','completed'))
);
--> statement-breakpoint
CREATE TABLE "task_completions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"root_task_id" uuid NOT NULL,
	"actor_id" uuid,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"undone_at" timestamp with time zone,
	CONSTRAINT "task_completions_status_check" CHECK ("task_completions"."status" in ('completed','undone')),
	CONSTRAINT "task_completions_undone_check" CHECK (("task_completions"."status" = 'undone') = ("task_completions"."undone_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "task_completion_items" ADD CONSTRAINT "task_completion_items_completion_id_task_completions_id_fk" FOREIGN KEY ("completion_id") REFERENCES "public"."task_completions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_completion_items" ADD CONSTRAINT "task_completion_items_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_root_task_id_tasks_id_fk" FOREIGN KEY ("root_task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "task_completion_items_task_idx" ON "task_completion_items" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX "task_completions_root_idx" ON "task_completions" USING btree ("root_task_id");
--> statement-breakpoint
CREATE INDEX "task_completions_actor_idx" ON "task_completions" USING btree ("actor_id");
