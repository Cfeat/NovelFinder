import { z } from "zod";
import { TAGS, type Favorite, type BookFeedback, type Tag, type ExplorationMode } from "./novels.ts";

export const PROFILE_STORAGE_KEY = "novel-finder.reader.v1";
export type ReaderProfile = {
  version: 1; favorites: Favorite[]; preferredTags: Tag[]; blockedTags: Tag[];
  feedback: BookFeedback[]; exploration: ExplorationMode;
};
export function emptyProfile(): ReaderProfile {
  return { version: 1, favorites: [], preferredTags: [], blockedTags: [], feedback: [], exploration: "balanced" };
}
const book = z.object({
  id: z.string().min(1).max(80), title: z.string().min(1).max(80), author: z.string().max(50),
  genre: z.string().max(80), description: z.string().max(1000), color: z.string().regex(/^#[0-9a-f]{6}$/i),
  tags: z.array(z.enum(TAGS)).max(20), source: z.string().url().refine(v => new URL(v).protocol === "https:").optional(),
  platform: z.enum(["fanqie", "jjwxc", "zongheng", "17k", "qidian", "qimao"]).optional(),
  providerId: z.string().max(80).optional(), syncedAt: z.number().finite().nonnegative().optional(),
  createdAt: z.number().finite().nonnegative().optional(), metadataKind: z.enum(["public", "curated"]).optional(),
  tagOrigin: z.enum(["mapped", "curated"]).optional(), sourceTags: z.array(z.string().max(100)).max(20).optional(),
});
const schema = z.object({
  version: z.literal(1), favorites: z.array(book).max(100),
  preferredTags: z.array(z.enum(TAGS)).max(20), blockedTags: z.array(z.enum(TAGS)).max(20),
  feedback: z.array(z.object({ book, kind: z.enum(["dismissed", "read"]), at: z.number().finite().nonnegative() })).max(200),
  exploration: z.enum(["focused", "balanced", "explore"]),
});
export function parseProfile(raw: string | null): ReaderProfile {
  if (raw === null) return emptyProfile();
  const parsed = schema.parse(JSON.parse(raw));
  return { ...parsed, preferredTags: [...new Set(parsed.preferredTags)].filter(t => !parsed.blockedTags.includes(t)), blockedTags: [...new Set(parsed.blockedTags)] };
}
