import { z } from "zod";
import { novels, TAGS, normalizeTitle, type Favorite } from "./novels.ts";

const inputSchema = z.union([
  z.object({ id: z.string().min(1).max(80) }).strict(),
  z.object({
    title: z.string().trim().min(1, "请填写小说名称。").max(80, "书名最多 80 个字。").refine(v => normalizeTitle(v).length > 0, "请填写有效的小说名称。"),
    author: z.string().trim().max(50).optional().default(""),
    tags: z.array(z.enum(TAGS)).min(1, "请选择至少一个喜欢的元素。").max(6, "最多选择六个元素。"),
  }).strict(),
]);

export async function validateFavorite(input: unknown, catalog = novels): Promise<Favorite> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new Error("请填写有效的书名，并选择 1–6 个喜欢的元素。");
  const value = parsed.data;
  if ("id" in value) {
    const book = catalog.find(n => n.id === value.id);
    if (!book) throw new Error("书库中没有这本小说，请使用手动添加。");
    return book;
  }
  const knownBook = catalog.find(n => normalizeTitle(n.title) === normalizeTitle(value.title) && (!value.author || normalizeTitle(n.author) === normalizeTitle(value.author)));
  if (knownBook) return knownBook;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizeTitle(value.title)));
  const id = "custom-" + Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, "0")).join("").slice(0, 32);
  return { id, title: value.title, author: value.author, tags: [...new Set(value.tags)], genre: "自定义", description: "你手动添加的喜好作品。", color: "#486b67" };
}
