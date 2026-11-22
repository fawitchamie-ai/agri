ALTER TABLE seasonal_campaigns ADD COLUMN archived_at TEXT;
--> statement-breakpoint
CREATE INDEX seasonal_campaign_archive ON seasonal_campaigns (coop_id, archived_at, updated_at);
--> statement-breakpoint
CREATE TABLE cooperative_profiles (
  coop_id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  region TEXT NOT NULL,
  locality TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
