import test from "node:test";
import assert from "node:assert/strict";
import { novels, recommend, normalizeTitle, preferenceTags } from "../lib/novels.ts";

test("cold start presents catalog picks without fabricated personalized claims", () => {
  const results = recommend([]);
  assert.equal(results.length, novels.length);
  assert.ok(results.every(r => r.level === "书库精选" && r.score === 0 && !r.closest));
});

test("liked books and equivalent custom titles never return as recommendations", () => {
  for (const book of novels) {
    assert.ok(!recommend([book]).some(r => r.book.id === book.id));
    const custom = { ...book, id: "custom-test", title: ` 《${book.title}》 ` };
    assert.ok(!recommend([custom]).some(r => normalizeTitle(r.book.title) === normalizeTitle(book.title)));
  }
});

test("recommendation reasons are grounded in actual shared tags and favorite titles", () => {
  const favorites = [novels[0], novels[1], novels[2]];
  for (const result of recommend(favorites)) {
    if (!result.closest || !result.shared.length) continue;
    assert.ok(favorites.some(f => f.id === result.closest.id));
    const actualShared = result.book.tags.filter(t => result.closest.tags.includes(t));
    assert.ok(actualShared.every(t => result.shared.includes(t)));
    assert.ok(result.reason.includes(result.closest.title));
    assert.ok(actualShared.some(t => result.reason.includes(t)));
  }
});

test("different reader tastes produce different top recommendations", () => {
  const fantasy = recommend([novels[0]])[0];
  const romance = recommend([novels.find(n => n.id === "female")])[0];
  assert.notEqual(fantasy.book.id, romance.book.id);
});

test("unrelated candidates are explicitly exploratory and all rankings are finite", () => {
  const custom = { ...novels[0], id: "custom-test", title: "测试日常作品", author: "", tags: ["日常"] };
  const results = recommend([custom]);
  assert.ok(results.every(r => Number.isFinite(r.score)));
  assert.ok(results.filter(r => !r.book.tags.includes("日常")).every(r => r.level === "探索推荐"));
  for (let i = 1; i < results.length; i++) assert.ok(results[i - 1].score >= results[i].score);
  assert.deepEqual(preferenceTags([custom]), [["日常", 1]]);
});

test("exhausting the catalog yields an honest empty result", () => {
  assert.deepEqual(recommend(novels), []);
});
