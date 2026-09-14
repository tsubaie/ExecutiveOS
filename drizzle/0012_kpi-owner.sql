-- A KPI is held by a person rather than by a free-text team: people are the only owner identity
-- in this product (ADR 0011), and a name typed twice is two teams.
ALTER TABLE "kpis" DROP CONSTRAINT "kpis_teams_check";--> statement-breakpoint
ALTER TABLE "kpis" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_owner_id_people_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kpis_owner_idx" ON "kpis" USING btree ("owner_id");