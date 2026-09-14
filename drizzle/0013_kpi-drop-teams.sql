-- The team names are not carried over: they never identified anyone the workspace knows, and an
-- owner is chosen from the directory instead.
ALTER TABLE "kpis" DROP COLUMN "teams";