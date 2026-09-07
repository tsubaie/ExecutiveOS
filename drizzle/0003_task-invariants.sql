CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE tasks ADD CONSTRAINT tasks_active_order_excl
EXCLUDE USING gist (coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid) WITH =, sort_order WITH =)
WHERE (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
CREATE FUNCTION eos_tasks_depth_check() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(7240);
  IF NEW.parent_id IS NOT NULL AND (
    NEW.parent_id = NEW.id OR
    EXISTS (SELECT 1 FROM tasks WHERE id = NEW.parent_id AND parent_id IS NOT NULL) OR
    EXISTS (SELECT 1 FROM tasks WHERE parent_id = NEW.id)
  ) THEN
    RAISE EXCEPTION 'TASKS-I01 depth one required' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER tasks_depth_check BEFORE INSERT OR UPDATE OF parent_id ON tasks
FOR EACH ROW EXECUTE FUNCTION eos_tasks_depth_check();
