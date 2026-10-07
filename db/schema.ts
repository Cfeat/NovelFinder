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
