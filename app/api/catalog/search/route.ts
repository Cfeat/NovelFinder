import { searchJinjiang } from "@/lib/catalog/adapters";
import { cacheBooks, readCatalog } from "@/db/catalog";
import { favoritesDb } from "@/db/favorites";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET(request: Request) {
  try {
    const user = await getChatGPTUser(); if (!user) return json({ error: "请登录后使用平台搜索。" }, 401);
    const query = new URL(request.url).searchParams.get("q")?.trim();
    if (!query || query.length < 2 || query.length > 50) return json({ error: "请填写 2–50 字的书名。" }, 400);
    const db = favoritesDb(); const now = Date.now();
    const lock = await db.prepare("INSERT INTO catalog_locks (id, expires_at) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET expires_at=excluded.expires_at WHERE catalog_locks.expires_at < ?").bind(`search:${user.userId}`, now + 10000, now).run();
    if (!lock.meta.changes) return json({ error: "请稍等 10 秒后再搜索。" }, 429);
    const books = await searchJinjiang(query); await cacheBooks(books, false);
    const catalog = await readCatalog();
    return json({ books: books.map(b => catalog.books.find(n => n.providerId === b.providerId && n.platform === b.platform) || b), platform: "jjwxc", query, coverage: "partial" });
  } catch (e) { console.error("Public book search failed", e); return json({ error: "晋江公开搜索暂时不可用，可搜索已收录书目或手动添加。" }, 503); }
}
