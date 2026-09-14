CREATE TABLE "kpi_readings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"kpi_id" uuid NOT NULL,
	"reading_date" date NOT NULL,
	"value" numeric(14, 4) NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_op_id" uuid,
	CONSTRAINT "kpi_readings_value_check" CHECK (abs("kpi_readings"."value") < 10000000000)
);
--> statement-breakpoint
CREATE TABLE "kpi_targets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kpi_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"quarter" integer NOT NULL,
	"target_value" numeric(14, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_op_id" uuid,
	CONSTRAINT "kpi_targets_quarter_check" CHECK ("kpi_targets"."quarter" between 1 and 4),
	CONSTRAINT "kpi_targets_year_check" CHECK ("kpi_targets"."year" between 1900 and 2999),
	CONSTRAINT "kpi_targets_value_check" CHECK (abs("kpi_targets"."target_value") < 10000000000)
);
--> statement-breakpoint
CREATE TABLE "kpis" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"direction" text DEFAULT 'higher' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"objective_id" uuid,
	"teams" text[] DEFAULT '{}' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"freshness_days" integer DEFAULT 120 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_op_id" uuid,
	"search_text" text GENERATED ALWAYS AS (eos_normalize(name || ' ' || category || ' ' || notes)) STORED,
	CONSTRAINT "kpis_name_check" CHECK (length(trim("kpis"."name")) between 1 and 500),
	CONSTRAINT "kpis_direction_check" CHECK ("kpis"."direction" in ('higher', 'lower')),
	CONSTRAINT "kpis_freshness_check" CHECK ("kpis"."freshness_days" between 1 and 3650),
	CONSTRAINT "kpis_teams_check" CHECK (cardinality("kpis"."teams") <= 10),
	CONSTRAINT "kpis_order_check" CHECK ("kpis"."sort_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "objectives" (
	"id" uuid PRIMARY KEY NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid,
	"updated_by" uuid,
	"deleted_at" timestamp with time zone,
	"deleted_op_id" uuid,
	CONSTRAINT "objectives_name_check" CHECK (length(trim("objectives"."name")) between 1 and 500),
	CONSTRAINT "objectives_order_check" CHECK ("objectives"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "kpi_readings" ADD CONSTRAINT "kpi_readings_kpi_id_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_readings" ADD CONSTRAINT "kpi_readings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_readings" ADD CONSTRAINT "kpi_readings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_kpi_id_kpis_id_fk" FOREIGN KEY ("kpi_id") REFERENCES "public"."kpis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_objective_id_objectives_id_fk" FOREIGN KEY ("objective_id") REFERENCES "public"."objectives"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_readings_date_unique" ON "kpi_readings" USING btree ("kpi_id","reading_date") WHERE "kpi_readings"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "kpi_readings_kpi_idx" ON "kpi_readings" USING btree ("kpi_id","reading_date");--> statement-breakpoint
CREATE INDEX "kpi_readings_creator_idx" ON "kpi_readings" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "kpi_readings_updater_idx" ON "kpi_readings" USING btree ("updated_by");--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_targets_quarter_unique" ON "kpi_targets" USING btree ("kpi_id","year","quarter") WHERE "kpi_targets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "kpi_targets_kpi_idx" ON "kpi_targets" USING btree ("kpi_id","year","quarter");--> statement-breakpoint
CREATE INDEX "kpi_targets_creator_idx" ON "kpi_targets" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "kpis_objective_idx" ON "kpis" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "kpis_creator_idx" ON "kpis" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "kpis_updater_idx" ON "kpis" USING btree ("updated_by");--> statement-breakpoint
CREATE INDEX "kpis_search_idx" ON "kpis" USING gin ("search_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "kpis_name_idx" ON "kpis" USING btree (lower("name"),"id");--> statement-breakpoint
CREATE INDEX "objectives_order_idx" ON "objectives" USING btree ("sort_order","id");--> statement-breakpoint
CREATE INDEX "objectives_creator_idx" ON "objectives" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "objectives_updater_idx" ON "objectives" USING btree ("updated_by");