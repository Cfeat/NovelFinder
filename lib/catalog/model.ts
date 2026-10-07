import { novels, normalizeTitle, type Novel, type PlatformId, type Tag } from "../novels.ts";

export const platforms: { id: PlatformId; name: string; url: string; scope: string }[] = [
  { id: "fanqie", name: "番茄小说", url: "https://fanqienovel.com/", scope: "首页公开推荐书目" },
  { id: "jjwxc", name: "晋江文学城", url: "https://www.jjwxc.net/bookbase.php", scope: "作品库前 5 页、按需书名搜索" },
  { id: "zongheng", name: "纵横中文网", url: "https://www.zongheng.com/", scope: "首页及 5 个分类页公开书目" },
  { id: "17k", name: "17K 小说网", url: "https://www.17k.com/all", scope: "作品库前 5 页" },
  { id: "qidian", name: "起点中文网", url: "https://www.qidian.com/", scope: "公开书库；访问失败时暂停入库" },
  { id: "qimao", name: "七猫中文网", url: "https://www.qimao.com/shuku/", scope: "公开书库；访问验证时暂停入库" },
];
export type SourceState = { platform: PlatformId; status: "ok" | "partial" | "blocked" | "error"; checkedAt: number; lastSuccessAt?: number; count: number; message: string };
export type CatalogPayload = { books: Novel[]; sources: SourceState[]; coverage: "partial"; error?: string; syncing?: boolean };
export const sourceName = (id?: PlatformId) => platforms.find(p => p.id === id)?.name || "本站整理";

// These are category mappings, not a claim to have analyzed the novel's text.
const tagRules: [Tag, RegExp][] = [
  ["悬疑", /悬疑|惊悚|灵异|恐怖/], ["推理", /推理|刑侦|侦探|破案/], ["修仙", /仙侠|修仙|修真/],
  ["历史", /历史|古代|古言|架空/], ["情感", /爱情|言情|纯爱|甜宠|恋爱|婚恋|虐恋/], ["日常", /日常|生活|种田/],
  ["科幻", /科幻|星际|末世/], ["竞技", /竞技|电竞/], ["热血", /热血/], ["成长", /成长|升级流/],
  ["冒险", /冒险/], ["幽默", /幽默|搞笑/], ["轻松", /轻松/], ["权谋", /权谋|宫斗|官场/],
  ["群像", /群像/], ["慢热", /慢热/], ["神话", /神话/], ["克系", /克苏鲁|克系/], ["建设", /建设|基建/], ["世界观", /世界观/],
];
export function mapTags(genre: string, sourceTags: string[]): Tag[] {
  const labels = [genre, ...sourceTags].join(" ");
  return tagRules.filter(([, pattern]) => pattern.test(labels)).map(([tag]) => tag);
}
export function catalogKey(book: Pick<Novel, "title" | "author">) { return `${normalizeTitle(book.title)}|${normalizeTitle(book.author)}`; }
export function mergeCatalog(publicBooks: Novel[]): Novel[] {
  const unique = new Map<string, Novel>();
  for (const book of publicBooks) {
    const key = catalogKey(book); const old = unique.get(key);
    if (!old || (book.syncedAt || 0) > (old.syncedAt || 0)) unique.set(key, book);
  }
  const seeds = novels.map(seed => {
    const verified = unique.get(catalogKey(seed));
    if (!verified) return { ...seed, metadataKind: "curated" as const };
    unique.delete(catalogKey(seed));
    return { ...verified, id: seed.id, tags: seed.tags, tagOrigin: "curated" as const, color: seed.color };
  });
  return [...seeds, ...unique.values()];
}
