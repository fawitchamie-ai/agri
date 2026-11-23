CREATE TABLE account_cooperatives (
  account_id TEXT NOT NULL,
  coop_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (account_id, coop_id),
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON UPDATE NO ACTION ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX account_cooperatives_coop ON account_cooperatives (coop_id, account_id);
--> statement-breakpoint
INSERT OR IGNORE INTO account_cooperatives (account_id, coop_id, role, created_at)
SELECT id, coop_id, role, created_at FROM accounts;
--> statement-breakpoint
-- Recover the original personal space for older accounts that were reassigned
-- before memberships existed. Only infer that space from persistent records.
INSERT OR IGNORE INTO account_cooperatives (account_id, coop_id, role, created_at)
SELECT account.id, 'real-' || account.id, 'responsable', account.created_at
FROM accounts account
WHERE account.coop_id <> 'real-' || account.id
  AND (
    EXISTS (SELECT 1 FROM cooperative_profiles profile WHERE profile.coop_id='real-' || account.id)
    OR EXISTS (SELECT 1 FROM business_records record WHERE record.coop_id='real-' || account.id)
    OR EXISTS (SELECT 1 FROM seasonal_campaigns campaign WHERE campaign.coop_id='real-' || account.id)
    OR EXISTS (SELECT 1 FROM scientific_imports science_import WHERE science_import.coop_id='real-' || account.id)
    OR EXISTS (SELECT 1 FROM land_jobs job WHERE job.coop_id='real-' || account.id)
  );
--> statement-breakpoint
-- Restore a safe, owner-only route to other scopes that contain records owned
-- by an account after an earlier cooperative reassignment.
INSERT OR IGNORE INTO account_cooperatives (account_id, coop_id, role, created_at)
SELECT account.id, owned.coop_id, 'producteur', account.created_at
FROM accounts account
JOIN (
  SELECT owner_id AS account_id, coop_id FROM business_records
  UNION SELECT owner_id AS account_id, coop_id FROM scientific_imports
  UNION SELECT owner_id AS account_id, coop_id FROM seasonal_campaigns
  UNION SELECT owner_id AS account_id, coop_id FROM land_jobs
) owned ON owned.account_id=account.id
WHERE owned.coop_id<>account.coop_id;
