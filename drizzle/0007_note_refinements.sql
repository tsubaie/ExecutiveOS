CREATE TABLE "note_refinements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"note_revision" integer NOT NULL,
	"content_hash" text NOT NULL,
	"capability_version" integer NOT NULL,
	"refined_content" text NOT NULL,
	"suggested_tasks" jsonb NOT NULL,
	"suggested_tags" text[] NOT NULL,
	"summary_of_changes" text NOT NULL,
	"status" text NOT NULL,
	"applied_task_ids" uuid[] DEFAULT '{}' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_op_id" uuid,
	CONSTRAINT "note_refinements_status_check" CHECK ("note_refinements"."status" in ('pending', 'applied', 'discarded', 'stale'))
);
--> statement-breakpoint
ALTER TABLE "note_refinements" ADD CONSTRAINT "note_refinements_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_refinements" ADD CONSTRAINT "note_refinements_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_refinements" ADD CONSTRAINT "note_refinements_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_refinements" ADD CONSTRAINT "note_refinements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "note_refinements_pending_idx" ON "note_refinements" USING btree ("note_id") WHERE "note_refinements"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "note_refinements_job_idx" ON "note_refinements" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "note_refinements_note_idx" ON "note_refinements" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "note_refinements_creator_idx" ON "note_refinements" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "note_refinements_reviewer_idx" ON "note_refinements" USING btree ("reviewed_by");