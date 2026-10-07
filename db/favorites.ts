import { type Favorite, type Tag } from "@/lib/novels";
import { readCatalog } from "./catalog";
import { favoritesDb } from "./client";
export { favoritesDb } from "./client";

type FavoriteRow = { id: string; title: string; author: string; tags_json: string; created_at: number };
export async function readFavorites(userId: string): Promise<Favorite[]> {
  const result = await favoritesDb().prepare("SELECT id, title, author, tags_json, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC, id ASC LIMIT 100").bind(userId).all<FavoriteRow>();
  const catalog = await readCatalog();
  return result.results.map(row => {
    const catalogBook = catalog.books.find(book => book.id === row.id);
    if (catalogBook) return { ...catalogBook, createdAt: row.created_at };
    return { id: row.id, title: row.title, author: row.author, tags: JSON.parse(row.tags_json) as Tag[], genre: "自定义", description: "你手动添加的喜好作品。", color: "#486b67", createdAt: row.created_at };
  });
}
