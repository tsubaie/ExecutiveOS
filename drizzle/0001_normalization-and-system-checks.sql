CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE FUNCTION eos_normalize(value text) RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT translate(regexp_replace(lower(value), '[ً-ٰٟـ]', '', 'g'), 'أإآٱى', 'ااااي') $$;
--> statement-breakpoint
ALTER TABLE people ADD COLUMN search_text text GENERATED ALWAYS AS (eos_normalize(full_name || ' ' || coalesce(display_name,'') || ' ' || coalesce(organization,'') || ' ' || coalesce(role_title,'') || ' ' || coalesce(email,''))) STORED;
--> statement-breakpoint
CREATE INDEX people_search_idx ON people USING gin(search_text gin_trgm_ops);
--> statement-breakpoint
ALTER TABLE workspace ADD CONSTRAINT workspace_singleton CHECK (id = 1);
--> statement-breakpoint
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','member'));
--> statement-breakpoint
ALTER TABLE users ADD CONSTRAINT users_email_lower_check CHECK (email = lower(email));
--> statement-breakpoint
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK (status IN ('queued','running','succeeded','failed','cancelled'));
--> statement-breakpoint
ALTER TABLE job_attempts ADD CONSTRAINT attempts_status_check CHECK (status IN ('running','succeeded','failed','abandoned'));
--> statement-breakpoint
ALTER TABLE files ADD CONSTRAINT files_availability_check CHECK (availability IN ('available','purged','missing'));
--> statement-breakpoint
ALTER TABLE ai_invocations ADD CONSTRAINT ai_status_check CHECK (status IN ('ok','error','refused','invalid_output'));
