CREATE TYPE "public"."usage_dimension" AS ENUM('ai_tokens', 'sandbox_minutes');--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"dimension" "usage_dimension" NOT NULL,
	"quantity" integer NOT NULL,
	"cost_micros" integer DEFAULT 0 NOT NULL,
	"period" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_events_non_negative" CHECK ("usage_events"."quantity" >= 0 and "usage_events"."cost_micros" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bots" ADD COLUMN "sandbox_touched_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "usage_events_dedupe_key_idx" ON "usage_events" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "usage_events_user_period_dimension_idx" ON "usage_events" USING btree ("user_id","period","dimension");