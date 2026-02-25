CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`provider` text NOT NULL,
	`provider_account_id` text NOT NULL,
	`refresh_token` text,
	`access_token` text,
	`expires_at` integer,
	`token_type` text,
	`scope` text,
	`id_token` text,
	`session_state` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `provider_account_idx` ON `accounts` (`provider`,`provider_account_id`);--> statement-breakpoint
CREATE TABLE `action_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`sender_profile_id` text,
	`action_type` text NOT NULL,
	`target_count` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error_message` text,
	`metadata` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sender_profile_id`) REFERENCES `sender_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `email_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`last_seen_scan_id` text,
	`thread_id` text,
	`sender_address` text NOT NULL,
	`sender_name` text,
	`sender_domain` text NOT NULL,
	`subject` text,
	`label_ids` text,
	`is_read` integer DEFAULT false NOT NULL,
	`is_starred` integer DEFAULT false NOT NULL,
	`list_unsubscribe` text,
	`list_unsubscribe_post` text,
	`received_at` integer,
	`last_updated` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `email_sender_idx` ON `email_messages` (`sender_address`);--> statement-breakpoint
CREATE INDEX `email_domain_idx` ON `email_messages` (`sender_domain`);--> statement-breakpoint
CREATE INDEX `email_user_idx` ON `email_messages` (`user_id`);--> statement-breakpoint
CREATE INDEX `email_scan_idx` ON `email_messages` (`last_seen_scan_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`error_message` text,
	`created_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `jobs_status_idx` ON `jobs` (`status`);--> statement-breakpoint
CREATE INDEX `jobs_type_idx` ON `jobs` (`type`);--> statement-breakpoint
CREATE TABLE `scans` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`total_messages` integer DEFAULT 0,
	`processed_messages` integer DEFAULT 0,
	`total_senders` integer DEFAULT 0,
	`error_message` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sender_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`scan_id` text NOT NULL,
	`sender_address` text NOT NULL,
	`sender_name` text,
	`sender_domain` text NOT NULL,
	`total_count` integer DEFAULT 0 NOT NULL,
	`read_count` integer DEFAULT 0 NOT NULL,
	`unread_count` integer DEFAULT 0 NOT NULL,
	`starred_count` integer DEFAULT 0 NOT NULL,
	`open_rate` real DEFAULT 0 NOT NULL,
	`sample_subjects` text,
	`has_list_unsubscribe` integer DEFAULT false,
	`list_unsubscribe_value` text,
	`list_unsubscribe_post_value` text,
	`oldest_email_at` integer,
	`newest_email_at` integer,
	`avg_frequency_days` real,
	`category` text,
	`category_confidence` real,
	`classified_at` integer,
	`clutter_score` real DEFAULT 0 NOT NULL,
	`user_action` text,
	`user_label` text,
	`action_executed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`scan_id`) REFERENCES `scans`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sender_user_scan_idx` ON `sender_profiles` (`user_id`,`scan_id`,`sender_address`);--> statement-breakpoint
CREATE INDEX `sender_clutter_idx` ON `sender_profiles` (`clutter_score`);--> statement-breakpoint
CREATE INDEX `sender_category_idx` ON `sender_profiles` (`category`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`session_token` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`auto_archive_threshold` integer DEFAULT 80,
	`default_action` text DEFAULT 'archive',
	`excluded_domains` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_preferences_user_id_unique` ON `user_preferences` (`user_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL,
	`email_verified` integer,
	`image` text
);
--> statement-breakpoint
CREATE TABLE `verification_tokens` (
	`identifier` text NOT NULL,
	`token` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `verification_token_idx` ON `verification_tokens` (`identifier`,`token`);