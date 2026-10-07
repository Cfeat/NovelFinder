import test from "node:test";
import assert from "node:assert/strict";
import { novels, recommend, recommendFeed, normalizeTitle, preferenceTags } from "../lib/novels.ts";

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

test("explicit interests personalize a new reader without pretending to know their favorite books", () => {
  const result = recommend([], novels, { preferredTags: ["竞技"] });
  assert.equal(result[0].book.id, "glory");
  assert.ok(result[0].reason.includes("主动选择") && !result[0].closest);
  assert.ok(result[0].channels.includes("主动偏好"));
});

test("read, dismissed and blocked content stay out of every feed including exploration slots", () => {
  const options = { preferredTags: ["科幻"], blockedTags: ["科幻"], exploration: "explore", feedback: [
    { book: novels[0], kind: "read", at: 1 },
    { book: { ...novels[3], id: "another-platform", title: " 《庆余年》 " }, kind: "dismissed", at: 2 },
  ] };
  for (const result of [recommend([], novels, options), recommendFeed([], novels, options, 100)]) {
    assert.ok(result.every(r => !r.book.tags.includes("科幻") && r.book.id !== novels[0].id && r.book.id !== novels[3].id));
    assert.equal(new Set(result.map(r => r.book.id)).size, result.length);
    assert.ok(result.every(r => Number.isFinite(r.score)));
  }
  assert.ok(recommend([], novels, { feedback: [] }).some(r => r.book.id === novels[0].id));
});

function syntheticBook(id, tags, author = "其他作者") {
  return { ...novels[0], id, title: id, author, tags, genre: tags[0] };
}
test("same-author retrieval works without any matching tags", () => {
  const favorite = syntheticBook("favorite", ["悬疑"], "甲");
  const candidates = [syntheticBook("unrelated", ["竞技"], "乙"), syntheticBook("same-author", ["竞技"], "甲")];
  const ranked = recommend([favorite], candidates);
  assert.equal(ranked[0].book.id, "same-author");
  assert.ok(ranked[0].reason.includes("甲") && ranked[0].channels.includes("同作者"));
});
test("re-ranking reduces runs of one author without changing base relevance scores", () => {
  const favorite = syntheticBook("favorite", ["悬疑"], "甲");
  const candidates = [0, 1, 2, 3].map(i => syntheticBook("same-" + i, ["悬疑"], "甲"));
  candidates.push(syntheticBook("different-author", ["悬疑"], "乙"));
  const ranked = recommend([favorite], candidates);
  const feed = recommendFeed([favorite], candidates, { exploration: "focused" }, 5);
  assert.equal(ranked[1].book.author, "甲");
  assert.equal(feed[1].book.author, "乙");
  assert.ok(feed.every(r => ranked.find(b => b.book.id === r.book.id).score === r.score));
});
test("exploration is controlled, labeled and grounded in novel reading elements", () => {
  const favorites = [syntheticBook("favorite", ["悬疑"])];
  const catalog = Array.from({ length: 12 }, (_, i) => syntheticBook("matching-" + i, ["悬疑"], "作者" + i));
  catalog.push(...Array.from({ length: 8 }, (_, i) => syntheticBook("explore-" + i, ["科幻"], "探索作者" + i)));
  const focused = recommendFeed(favorites, catalog, { exploration: "focused" }, 6);
  const balanced = recommendFeed(favorites, catalog, { exploration: "balanced" }, 6);
  const explore = recommendFeed(favorites, catalog, { exploration: "explore" }, 6);
  assert.ok(focused.every(r => !r.exploration));
  assert.ok(balanced[5].exploration && balanced[5].reason.includes("科幻"));
  assert.ok(explore[2].exploration && explore[5].exploration);
  assert.deepEqual(explore, recommendFeed(favorites, catalog, { exploration: "explore" }, 6));
  assert.deepEqual(recommendFeed([], [], {}, 24), []);
});
