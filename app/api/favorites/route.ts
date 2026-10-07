import { getChatGPTUser } from "@/app/chatgpt-auth";
import { favoritesDb, readFavorites } from "@/db/favorites";
import { validateFavorite } from "@/lib/favorite-input";
import { normalizeTitle } from "@/lib/novels";
export const dynamic = "force-dynamic";
function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" } });
}
function unavailable(error: unknown) {
  console.error("Favorites request failed", error);
  return json({ error: "暂时无法访问喜好书单，请稍后重试。你的输入仍然保留。" }, 503);
}
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user) return json({ favorites: [], signedIn: false });
    return json({ favorites: await readFavorites(user.userId), signedIn: true });
  } catch (error) { return unavailable(error); }
}
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    if (!sameOrigin(request)) return json({ error: "请求来源无效，请刷新页面后重试。" }, 403);
    const user = await getChatGPTUser();
    if (!user) return json({ error: "请先登录，再保存你的喜好书单。" }, 401);
    if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "请提交有效的小说信息。" }, 400);
    if (raw.length > 10000) return json({ error: "输入内容过长。" }, 413);
    let input: unknown;
    try { input = JSON.parse(raw); } catch { return json({ error: "小说信息格式无效。" }, 400); }
    let book;
    try { book = await validateFavorite(input); } catch (error) { return json({ error: error instanceof Error ? error.message : "小说信息无效。" }, 400); }
    const result = await favoritesDb().prepare(`INSERT INTO favorites (user_id, id, normalized_title, title, author, tags_json, created_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM favorites WHERE user_id = ?) < 100
      ON CONFLICT DO NOTHING`).bind(user.userId, book.id, normalizeTitle(book.title), book.title, book.author, JSON.stringify(book.tags), Date.now(), user.userId).run();
    const favorites = await readFavorites(user.userId);
    if (!result.meta.changes) {
      const duplicate = favorites.some(f => normalizeTitle(f.title) === normalizeTitle(book.title));
      return json({ error: duplicate ? "这本小说已经在你的喜好书单里了。" : "书单最多保存 100 本，请先移除一些作品。" }, duplicate ? 409 : 400);
    }
    return json({ favorites, addedTitle: book.title, signedIn: true }, 201);
  } catch (error) { return unavailable(error); }
}
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return json({ error: "请求来源无效，请刷新页面后重试。" }, 403);
  try {
    const user = await getChatGPTUser();
    if (!user) return json({ error: "请先登录，再修改喜好书单。" }, 401);
    const id = new URL(request.url).searchParams.get("id");
    if (!id || id.length > 80) return json({ error: "请选择要移除的小说。" }, 400);
    await favoritesDb().prepare("DELETE FROM favorites WHERE user_id = ? AND id = ?").bind(user.userId, id).run();
    return json({ favorites: await readFavorites(user.userId), signedIn: true });
  } catch (error) { return unavailable(error); }
}
