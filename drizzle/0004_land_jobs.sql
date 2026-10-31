CREATE TABLE land_jobs (
 id TEXT PRIMARY KEY, coop_id TEXT NOT NULL, owner_id TEXT NOT NULL,
 geometry TEXT NOT NULL, created_at TEXT NOT NULL, completed_at TEXT,
 total INTEGER NOT NULL, result TEXT
);
CREATE INDEX land_jobs_owner ON land_jobs(coop_id,owner_id,created_at);
CREATE TABLE land_sectors (
 job_id TEXT NOT NULL REFERENCES land_jobs(id), sector INTEGER NOT NULL,
 geometry TEXT NOT NULL, area_m2 REAL NOT NULL, result TEXT,
 lease TEXT, lease_at TEXT, error TEXT,
 PRIMARY KEY(job_id,sector)
);
