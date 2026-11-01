CREATE TABLE IF NOT EXISTS "tournament_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tournament_id" uuid NOT NULL REFERENCES "tournaments"("id") ON DELETE cascade,
	"match_id" uuid NOT NULL REFERENCES "tournament_matches"("id") ON DELETE cascade,
	"reported_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE cascade,
	"target_team_id" uuid REFERENCES "teams"("id") ON DELETE set null,
	"target_player_ign" varchar(50),
	"incident_type" varchar(50) NOT NULL,
	"severity" varchar(20) DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"evidence_url" text,
	"status" varchar(20) DEFAULT 'flagged' NOT NULL,
	"resolution_notes" text,
	"resolved_by" uuid REFERENCES "users"("id") ON DELETE set null,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_incidents_match_id" ON "tournament_incidents" ("match_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_incidents_status" ON "tournament_incidents" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_incidents_tournament_id" ON "tournament_incidents" ("tournament_id");
