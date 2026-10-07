CREATE TABLE `catalog_books` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`payload_json` text NOT NULL,
	`fetched_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_locks` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_sources` (
	`platform` text PRIMARY KEY NOT NULL,
	`state_json` text NOT NULL,
	`checked_at` integer NOT NULL
);
