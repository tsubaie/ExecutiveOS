CREATE TABLE "ai_credentials" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credentials_singleton" CHECK ("ai_credentials"."id" = 1),
	CONSTRAINT "ai_credentials_provider" CHECK ("ai_credentials"."provider" in ('anthropic', 'openrouter'))
);
