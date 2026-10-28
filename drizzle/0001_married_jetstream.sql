CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`coop_id` text NOT NULL,
	`role` text NOT NULL,
	`member_id` text,
	`email` text,
	`created_by` text NOT NULL,
	`expires_at` text NOT NULL,
	`accepted_by` text,
	`accepted_at` text
);
--> statement-breakpoint
CREATE INDEX `invitations_token` ON `invitations` (`token_hash`);