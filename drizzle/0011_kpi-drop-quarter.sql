-- The quarter and the freshness window are carried over by 0010; the columns they replaced go
-- once nothing reads them.
ALTER TABLE "kpi_targets" DROP COLUMN "quarter";--> statement-breakpoint
ALTER TABLE "kpis" DROP COLUMN "freshness_days";