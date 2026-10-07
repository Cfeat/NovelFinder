import { parseDocument, DomUtils } from "htmlparser2";
import { mapTags, type SourceState } from "./model.ts";
import type { Novel, PlatformId } from "../novels.ts";

type Element = ReturnType<typeof DomUtils.getElementsByTagName>[number];
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const text = (node?: Element) => node ? clean(DomUtils.textContent(node)) : "";
const elements = (node: { children: Parameters<typeof DomUtils.findAll>[1] }, tag: string) => DomUtils.getElementsByTagName(tag, node.children, true);
const links = (node: { children: Parameters<typeof DomUtils.findAll>[1] }) => elements(node, "a");
const classes = (node: Element) => (node.attribs.class || "").split(/\s+/);
const byClass = (node: { children: Parameters<typeof DomUtils.findAll>[1] }, value: string) => DomUtils.findAll(el => classes(el).includes(value), node.children);
function book(platform: PlatformId, id: string, title: string, author: string, genre: string, description: string, sourceTags: string[], at: number): Novel | undefined {
  if (!/^\d{1,24}$/.test(id) || !clean(title) || !clean(author) || title.includes("�") || author.includes("�")) return;
  const origins = { fanqie: `https://fanqienovel.com/page/${id}`, jjwxc: `https://www.jjwxc.net/onebook.php?novelid=${id}`, zongheng: `https://www.zongheng.com/detail/${id}`, "17k": `https://www.17k.com/book/${id}.html`, qidian: `https://www.qidian.com/book/${id}/`, qimao: `https://www.qimao.com/shuku/${id}/` };
  return { id: `${platform}-${id}`, providerId: id, platform, title: clean(title).slice(0, 80), author: clean(author).slice(0, 50), genre: clean(genre).slice(0, 80) || "未分类", description: clean(description).slice(0, 320) || "原站未在此公开列表提供简介，请查看作品来源。", sourceTags: sourceTags.map(clean).filter(Boolean).slice(0, 20), tags: mapTags(genre, sourceTags), color: { fanqie: "#926042", jjwxc: "#5e7462", zongheng: "#476583", "17k": "#79674d", qidian: "#735960", qimao: "#887143" }[platform], source: origins[platform], syncedAt: at, metadataKind: "public" };
}
export function parseFanqie(html: string, at: number): Novel[] {
  const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});\s*\}/);
  if (!match) throw new Error("页面未返回公开书目数据");
  const state = JSON.parse(match[1]); const books: Novel[] = [];
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const v = value as Record<string, unknown>;
    if (typeof v.bookId === "string" && typeof v.bookName === "string" && typeof v.author === "string") {
      const item = book("fanqie", v.bookId, v.bookName, v.author, String(v.category || ""), String(v.abstract || ""), [], at);
      if (item) books.push(item);
    } else Object.values(v).forEach(visit);
  };
  visit(state.home); return uniqueBooks(books);
}
export function parseJinjiang(html: string, at: number): Novel[] {
  const doc = parseDocument(html); const books: Novel[] = [];
  for (const row of elements(doc, "tr")) {
    const anchors = links(row); const title = anchors.find(a => /onebook\.php\?novelid=\d+/.test(a.attribs.href || ""));
    const author = anchors.find(a => /oneauthor\.php\?authorid=/.test(a.attribs.href || ""));
    if (!title || !author) continue;
    const cells = elements(row, "td"); const info = title.attribs.title || "";
    const parts = info.split(/标签[：:]/); const tags = (parts[1] || "").split(/\s+/);
    const item = book("jjwxc", title.attribs.href.match(/novelid=(\d+)/)![1], text(title), text(author), text(cells[2]), parts[0].replace(/^简介[：:]/, ""), tags, at);
    if (item) books.push(item);
  }
  return uniqueBooks(books);
}
export function parse17k(html: string, at: number): Novel[] {
  const doc = parseDocument(html); const books: Novel[] = [];
  for (const row of elements(doc, "tr")) {
    const title = byClass(row, "jt")[0]; const author = byClass(row, "td6")[0];
    const id = title?.attribs.href?.match(/\/book\/(\d+)\.html/)?.[1]; if (!id || !author) continue;
    const category = byClass(row, "td2")[0]; const tagBlock = byClass(row, "bq10")[0];
    const description = elements(row, "p").find(p => text(p).startsWith("简介："));
    const item = book("17k", id, text(title), text(author), text(category).replace(/[\[\]]/g, ""), text(description).replace(/^简介：/, ""), tagBlock ? links(tagBlock).map(a => text(a).replace(/>$/, "")) : [], at);
    if (item) books.push(item);
  }
  return uniqueBooks(books);
}
export function parseZongheng(html: string, at: number): Novel[] {
  const doc = parseDocument(html); const books: Novel[] = [];
  for (const title of links(doc)) {
    const id = title.attribs.href?.match(/\/(?:detail|book)\/(\d+)/)?.[1];
    if (!id || !(title.attribs.title || text(title))) continue;
    let parent = title.parent; let count = 0;
    while (parent && count++ < 7) {
      if (parent.type !== "tag") { parent = parent.parent; continue; }
      const anchors = links(parent as Element);
      const ids = new Set(anchors.map(a => a.attribs.href?.match(/\/(?:detail|book)\/(\d+)/)?.[1]).filter(Boolean));
      if (ids.size > 1) break;
      const author = anchors.find(a => /(?:show\/userInfo|\/author\/)/.test(a.attribs.href || ""));
      if (author) {
        const genre = anchors.find(a => /\/categories\?/.test(a.attribs.href || ""));
        const description = anchors.find(a => /desc/i.test(a.attribs.class || ""));
        const item = book("zongheng", id, title.attribs.title || text(title), text(author), text(genre), description?.attribs.title || text(description), [], at);
        if (item) books.push(item); break;
      }
      parent = parent.parent;
    }
  }
  return uniqueBooks(books);
}
export function parseQidian(html: string, at: number): Novel[] {
  const doc = parseDocument(html); const books: Novel[] = [];
  for (const row of elements(doc, "li")) {
    const title = links(row).find(a => /(?:book\/|info\/)(\d+)/.test(a.attribs.href || ""));
    const author = byClass(row, "name")[0]; const id = title?.attribs.href?.match(/(?:book\/|info\/)(\d+)/)?.[1];
    if (!id || !author) continue;
    const item = book("qidian", id, title!.attribs.title || text(title), text(author), text(byClass(row, "author")[0]?.children ? links(byClass(row, "author")[0]).find(a => a !== author) : undefined), text(byClass(row, "intro")[0]), [], at);
    if (item) books.push(item);
  }
  return uniqueBooks(books);
}
export function parseQimao(html: string, at: number): Novel[] {
  const doc = parseDocument(html); const books: Novel[] = [];
  for (const row of byClass(doc, "book-list-item")) {
    const title = links(row).find(a => /\/shuku\/\d+/.test(a.attribs.href || "")); const author = byClass(row, "author")[0];
    const id = title?.attribs.href?.match(/\/shuku\/(\d+)/)?.[1]; if (!id || !author) continue;
    const item = book("qimao", id, title!.attribs.title || text(title), text(author), text(byClass(row, "category")[0]), text(byClass(row, "intro")[0]), [], at);
    if (item) books.push(item);
  }
  return uniqueBooks(books);
}
export function uniqueBooks(books: Novel[]): Novel[] {
  const result = new Map<string, Novel>();
  for (const b of books) {
    const old = result.get(b.id);
    if (!old) { result.set(b.id, b); continue; }
    const genre = old.genre === "未分类" ? b.genre : old.genre;
    const sourceTags = [...new Set([...(old.sourceTags || []), ...(b.sourceTags || [])])];
    result.set(b.id, { ...old, genre, sourceTags, tags: mapTags(genre, sourceTags), description: b.description.length > old.description.length ? b.description : old.description });
  }
  return [...result.values()];
}
export async function fetchPublicPage(url: string, encoding: "utf-8" | "gb18030" = "utf-8") {
  let response: Response;
  try { response = await fetch(url, { headers: { "User-Agent": "NovelFinder/1.0 (public book metadata; limited requests)", "Accept": "text/html,application/json" }, signal: AbortSignal.timeout(9000), redirect: "manual" }); }
  catch (e) { throw new Error(e instanceof Error && e.name === "TimeoutError" ? "平台公开页面请求超时" : "无法连接平台公开页面"); }
  if (response.status === 202 || response.status === 403 || response.status === 429) throw new Error("平台要求访问验证或限制请求");
  if (!response.ok) throw new Error(`公开页面返回 HTTP ${response.status}`);
  const bytes = await response.arrayBuffer(); if (bytes.byteLength > 2500000) throw new Error("公开页面超过读取上限");
  const html = new TextDecoder(encoding).decode(bytes);
  if (/aliyun_waf_aa|var arg1=|acw_sc__v2|访问过于频繁/.test(html)) throw new Error("平台要求访问验证或限制请求");
  return html;
}
const jinjiangPage = (page: number) => `https://www.jjwxc.net/bookbase.php?fw=0&yc=1&xx=0&mainview=0&sd=0&lx=0&fg=0&bq=-1&sortType=0&isfinish=0&collectiontypes=ors&searchkeywords=&page=${page}`;
export const sourcePages: Record<PlatformId, string[]> = {
  fanqie: ["https://fanqienovel.com/"],
  jjwxc: Array.from({ length: 5 }, (_, i) => jinjiangPage(i + 1)),
  zongheng: ["https://www.zongheng.com/", ...[8101, 8102, 8103, 8104, 8105].map(id => `https://www.zongheng.com/categories?cateFineId=${id}`)],
  "17k": ["https://www.17k.com/all", ...Array.from({ length: 4 }, (_, i) => `https://www.17k.com/all/book/2_0_0_0_0_0_0_0_${i + 2}.html`)],
  qidian: ["https://www.qidian.com/all/"], qimao: ["https://www.qimao.com/shuku/"],
};
const parsers = { fanqie: parseFanqie, jjwxc: parseJinjiang, zongheng: parseZongheng, "17k": parse17k, qidian: parseQidian, qimao: parseQimao };
export async function fetchSource(platform: PlatformId): Promise<{ books: Novel[]; state: SourceState }> {
  const at = Date.now(); const books: Novel[] = []; const failures: string[] = [];
  // At most one request at a time per platform. A failure stops the batch.
  for (const url of sourcePages[platform]) {
    try {
      const found = parsers[platform](await fetchPublicPage(url, platform === "jjwxc" ? "gb18030" : "utf-8"), at);
      if (!found.length) throw new Error("公开页面未返回可识别书目，可能需要验证或页面已变更");
      books.push(...found);
    } catch (e) { failures.push(e instanceof Error && /公开|平台/.test(e.message) ? e.message : "公开页面格式已变更，暂时无法解析"); break; }
  }
  const unique = uniqueBooks(books);
  const status = failures.length ? unique.length ? "partial" : failures.some(f => /验证|限制/.test(f)) ? "blocked" : "error" : "ok";
  return { books: unique, state: { platform, status, checkedAt: at, lastSuccessAt: unique.length ? at : undefined, count: unique.length, message: failures[0] || "已读取所列公开页面；覆盖范围为部分书目" } };
}
export async function searchJinjiang(query: string): Promise<Novel[]> {
  const at = Date.now(); const data = JSON.parse(await fetchPublicPage(`https://www.jjwxc.net/search/search_ajax.php?action=search&keywords=${encodeURIComponent(query)}&type=1&version=1&getfull=1`));
  if (data.status !== 200 || !Array.isArray(data.data)) throw new Error("晋江公开搜索暂时不可用");
  const books: Novel[] = [];
  for (const row of data.data.slice(0, 8)) {
    const item = book("jjwxc", String(row.novelid), String(row.novelname || ""), String(row.authorname || ""), "未分类", "搜索结果未提供分类与简介。可以查看原站详情，或手动添加喜欢的元素。", [], at);
    if (item) books.push(item);
  }
  return books;
}
