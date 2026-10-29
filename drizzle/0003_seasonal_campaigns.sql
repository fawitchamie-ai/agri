CREATE TABLE `seasonal_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`coop_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`revision` integer NOT NULL,
	`config` text NOT NULL,
	`events` text NOT NULL,
	`plan` text NOT NULL,
	`demo` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `seasonal_campaign_scope` ON `seasonal_campaigns` (`coop_id`,`owner_id`);--> statement-breakpoint
CREATE TABLE `seasonal_revisions` (
	`campaign_id` text NOT NULL,
	`revision` integer NOT NULL,
	`actor_id` text NOT NULL,
	`config` text NOT NULL,
	`events` text NOT NULL,
	`plan` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `revision`),
	FOREIGN KEY (`campaign_id`) REFERENCES `seasonal_campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
