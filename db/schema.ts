import { sqliteTable, text, integer, primaryKey, uniqueIndex } from "drizzle-orm/sqlite-core";

export const favorites = sqliteTable("favorites", {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  normalizedTitle: text("normalized_title").notNull(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  tagsJson: text("tags_json").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [
  primaryKey({ columns: [table.userId, table.id] }),
  uniqueIndex("idx_favorites_user_title").on(table.userId, table.normalizedTitle),
]);

export const catalogBooks = sqliteTable("catalog_books", {
  id: text("id").primaryKey(),
  platform: text("platform").notNull(),
  payloadJson: text("payload_json").notNull(),
  fetchedAt: integer("fetched_at").notNull(),
});
export const catalogSources = sqliteTable("catalog_sources", {
  platform: text("platform").primaryKey(),
  stateJson: text("state_json").notNull(),
  checkedAt: integer("checked_at").notNull(),
});
export const catalogLocks = sqliteTable("catalog_locks", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at").notNull(),
});
