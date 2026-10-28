CREATE TABLE `scientific_forecasts` (
	`id` text PRIMARY KEY NOT NULL,
	`coop_id` text NOT NULL,
	`import_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `forecasts_scope` ON `scientific_forecasts` (`coop_id`);--> statement-breakpoint
DROP INDEX `imports_scope`;--> statement-breakpoint
CREATE UNIQUE INDEX `imports_scope` ON `scientific_imports` (`coop_id`,`hash`);