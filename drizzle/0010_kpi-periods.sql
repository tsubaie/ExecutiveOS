-- A KPI is now read at the cadence it is reported on, so a target belongs to a period of that
-- cadence rather than always to a quarter, and a unit is one of a closed list. Existing rows are
-- carried over: every KPI keeps its quarterly reading by taking `quarterly` as its frequency, and
-- every target's quarter becomes its period unchanged.
ALTER TABLE "kpi_targets" DROP CONSTRAINT "kpi_targets_quarter_check";--> statement-breakpoint
ALTER TABLE "kpis" DROP CONSTRAINT "kpis_freshness_check";--> statement-breakpoint
DROP INDEX "kpi_targets_quarter_unique";--> statement-breakpoint
DROP INDEX "kpi_targets_kpi_idx";--> statement-breakpoint
ALTER TABLE "kpis" ALTER COLUMN "unit" SET DEFAULT 'count';--> statement-breakpoint
ALTER TABLE "kpis" ADD COLUMN "frequency" text DEFAULT 'quarterly' NOT NULL;--> statement-breakpoint
-- The column arrives empty, takes the quarter it replaces, and only then becomes required.
ALTER TABLE "kpi_targets" ADD COLUMN "period" integer;--> statement-breakpoint
UPDATE "kpi_targets" SET "period" = "quarter";--> statement-breakpoint
ALTER TABLE "kpi_targets" ALTER COLUMN "period" SET NOT NULL;--> statement-breakpoint
-- Free text becomes one of the five units. Anything that was not a currency or a percentage is a
-- plain count, which is what the default already said.
UPDATE "kpis" SET "unit" = CASE
  WHEN lower(trim("unit")) IN ('%', 'percent', 'percentage', 'نسبة') THEN 'percent'
  WHEN lower(trim("unit")) IN ('sar', 'ر.س', 'ريال') THEN 'sar'
  WHEN lower(trim("unit")) IN ('usd', '$', 'dollar') THEN 'usd'
  WHEN lower(trim("unit")) IN ('pts', 'points', 'point', 'نقطة', 'نقاط') THEN 'points'
  ELSE 'count'
END;--> statement-breakpoint
CREATE UNIQUE INDEX "kpi_targets_period_unique" ON "kpi_targets" USING btree ("kpi_id","year","period") WHERE "kpi_targets"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "kpi_targets_kpi_idx" ON "kpi_targets" USING btree ("kpi_id","year","period");--> statement-breakpoint
ALTER TABLE "kpi_targets" ADD CONSTRAINT "kpi_targets_period_check" CHECK ("kpi_targets"."period" between 1 and 12);--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_unit_check" CHECK ("kpis"."unit" in ('count', 'percent', 'sar', 'usd', 'points'));--> statement-breakpoint
ALTER TABLE "kpis" ADD CONSTRAINT "kpis_frequency_check" CHECK ("kpis"."frequency" in ('monthly', 'quarterly', 'annual'));
