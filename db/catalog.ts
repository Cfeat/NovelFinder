import { favoritesDb } from "./client";
import { mergeCatalog, platforms, type CatalogPayload, type SourceState } from "@/lib/catalog/model";
import { snapshotBooks, snapshotSources } from "@/lib/catalog/snapshot";
import { fetchSource } from "@/lib/catalog/adapters";
import type { Novel, PlatformId } from "@/lib/novels";

const TTL = 24 * 60 * 60 * 1000;
export async function readCatalog(): Promise<CatalogPayload> {
  const db = favoritesDb();
  const [books, sources] = await Promise.all([
    db.prepare("SELECT payload_json FROM catalog_books ORDER BY fetched_at DESC, id LIMIT 10000").all<{ payload_json: string }>(),
    db.prepare("SELECT state_json FROM catalog_sources").all<{ state_json: string }>(),
  ]);
  const publicBooks = [...snapshotBooks, ...books.results.map(row => JSON.parse(row.payload_json) as Novel)];
  const byId = new Map(publicBooks.map(book => [book.id, book]));
  const states = new Map(snapshotSources.map(s => [s.platform, s]));
  for (const row of sources.results) { const state = JSON.parse(row.state_json) as SourceState; states.set(state.platform, state); }
  return { books: mergeCatalog([...byId.values()]), sources: platforms.map(p => {
    const state = states.get(p.id)!;
    return { ...state, count: [...byId.values()].filter(b => b.platform === p.id).length };
  }), coverage: "partial" };
}
export async function findCatalogBook(id: string): Promise<Novel | undefined> {
  const payload = await readCatalog(); return payload.books.find(b => b.id === id);
}
export async function cacheBooks(books: Novel[], replace = true) {
  const db = favoritesDb();
  // Sparse search results must not replace the richer bundled metadata either.
  const snapshotIds = new Set(snapshotBooks.map(b => b.id));
  const pending = replace ? books : books.filter(b => !snapshotIds.has(b.id));
  for (let start = 0; start < pending.length; start += 75) {
    await db.batch(pending.slice(start, start + 75).map(book => db.prepare(`INSERT INTO catalog_books (id, platform, payload_json, fetched_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) ${replace ? "DO UPDATE SET payload_json=excluded.payload_json, fetched_at=excluded.fetched_at WHERE excluded.fetched_at >= catalog_books.fetched_at" : "DO NOTHING"}`).bind(book.id, book.platform!, JSON.stringify(book), book.syncedAt!)));
  }
}
export async function syncCatalog(force = false): Promise<CatalogPayload> {
  const current = await readCatalog(); const now = Date.now();
  const due = current.sources.filter(s => now - s.checkedAt >= (force ? 60 * 60 * 1000 : TTL)).map(s => s.platform);
  if (!due.length) return current;
  const db = favoritesDb();
  const lock = await db.prepare("INSERT INTO catalog_locks (id, expires_at) VALUES ('sync', ?) ON CONFLICT(id) DO UPDATE SET expires_at=excluded.expires_at WHERE catalog_locks.expires_at < ?").bind(now + 120000, now).run();
  if (!lock.meta.changes) return { ...current, syncing: true };
  try {
    await Promise.all(due.map(async (platform: PlatformId) => {
      const result = await fetchSource(platform);
      await cacheBooks(result.books);
      const previous = current.sources.find(s => s.platform === platform)!;
      const state = { ...result.state, lastSuccessAt: result.state.lastSuccessAt || previous.lastSuccessAt };
      await db.prepare("INSERT INTO catalog_sources (platform, state_json, checked_at) VALUES (?, ?, ?) ON CONFLICT(platform) DO UPDATE SET state_json=excluded.state_json, checked_at=excluded.checked_at").bind(platform, JSON.stringify(state), state.checkedAt).run();
    }));
    return await readCatalog();
  } finally { await db.prepare("DELETE FROM catalog_locks WHERE id='sync' AND expires_at=?").bind(now + 120000).run(); }
}
