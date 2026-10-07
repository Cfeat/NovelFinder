CREATE TABLE `favorites` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`normalized_title` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`tags_json` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_favorites_user_title` ON `favorites` (`user_id`,`normalized_title`);