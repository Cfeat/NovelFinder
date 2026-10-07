import { env } from "cloudflare:workers";
export function favoritesDb() {
  if (!env.DB) throw new Error("Application DB is unavailable");
  return env.DB;
}
