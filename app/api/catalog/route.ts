import { readCatalog, syncCatalog } from "@/db/catalog";
import { isLocalRequest } from "@/lib/local-request";
export const dynamic = "force-dynamic";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
export async function GET() {
  try { return json(await readCatalog()); }
  catch (e) { console.error("Catalog read failed", e); return json({ error: "暂时无法读取书库，请重试。" }, 503); }
}
export async function POST(request: Request) {
  try {
    const raw = await request.text();
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return json({ error: "请求来源无效。" }, 403);
    if (!isLocalRequest(request)) return json({ error: "书源更新仅在本地运行时可用。" }, 403);
    if (raw.length > 1000) return json({ error: "请求过长。" }, 413);
    let input: unknown; try { input = JSON.parse(raw); } catch { return json({ error: "请求格式无效。" }, 400); }
    if (!input || typeof input !== "object" || Object.keys(input).some(k => k !== "force") || ("force" in input && typeof input.force !== "boolean")) return json({ error: "请求格式无效。" }, 400);
    return json(await syncCatalog("force" in input && input.force === true));
  } catch (e) { console.error("Catalog sync failed", e); return json({ error: "更新暂时失败，已收录书目仍可使用。" }, 503); }
}
