-- ADR 0022: the notification centre. One row per recipient, addressed to a user rather than to a
-- person: `people.user_id` resolves an owner or a participant to an account, and a person without
-- one is not a recipient at all. There is no foreign key to the five module tables a subject can
-- live in; `subject_type`/`subject_id` are a soft reference the feed resolves through the owning
-- module at read time, so a deleted subject drops out of the feed instead of dangling.
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notifications_kind_check" CHECK ("notifications"."kind" in ('task.assigned','task.due_today','task.overdue','note.mentioned','kpi.off_target','job.finished'))
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_feed_idx" ON "notifications" USING btree ("user_id","read_at","created_at" DESC);--> statement-breakpoint
-- NOTIF-I02: at most one unread row per (user, kind, subject). This is what makes emission an
-- idempotent upsert: a task reassigned to the same person four times is one unread line, refreshed
-- to the top, not four. Once read, a later event about the same subject inserts again -- it is news
-- again -- which is why the index is partial rather than total.
CREATE UNIQUE INDEX "notifications_unread_subject_idx" ON "notifications" USING btree ("user_id","kind","subject_id") WHERE "notifications"."read_at" is null;
