CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`coop_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `record_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`record_id` text NOT NULL,
	`coop_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `changes_record` ON `record_changes` (`record_id`);--> statement-breakpoint
CREATE TABLE `demo_sessions` (
	`token` text PRIMARY KEY NOT NULL,
	`root_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`coop_id` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `business_records` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`coop_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `records_scope` ON `business_records` (`coop_id`,`kind`);--> statement-breakpoint
CREATE TABLE `scientific_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`coop_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`hash` text NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `imports_scope` ON `scientific_imports` (`coop_id`,`hash`);