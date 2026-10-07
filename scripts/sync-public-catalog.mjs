import fs from "node:fs/promises";
import { fetchSource } from "../lib/catalog/adapters.ts";
import { platforms } from "../lib/catalog/model.ts";

const results = await Promise.allSettled(platforms.map(p => fetchSource(p.id)));
const books = []; const sources = [];
for (const result of results) {
  if (result.status !== "fulfilled") throw result.reason;
  books.push(...result.value.books); sources.push(result.value.state);
}
if (!books.length) throw new Error("All public sources failed; existing snapshot is preserved.");
await fs.mkdir("data", { recursive: true });
await fs.writeFile("data/public-catalog.json", JSON.stringify({ books, sources, coverage: "partial" }, null, 2) + "\n");
console.log(JSON.stringify({ total: books.length, sources: sources.map(s => ({ platform: s.platform, status: s.status, count: s.count, message: s.message })) }));
