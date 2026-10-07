import snapshot from "@/data/public-catalog.json";
import type { Novel } from "@/lib/novels";
import type { SourceState } from "./model";

export const snapshotBooks = snapshot.books as Novel[];
export const snapshotSources = snapshot.sources as SourceState[];
