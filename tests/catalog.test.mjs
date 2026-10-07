import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { parseFanqie, parseJinjiang, parse17k, parseZongheng, fetchSource, uniqueBooks } from "../lib/catalog/adapters.ts";
import { mapTags, mergeCatalog } from "../lib/catalog/model.ts";
import { recommend } from "../lib/novels.ts";
import { validateFavorite } from "../lib/favorite-input.ts";

test("platform pages preserve provider identifiers, authors and safe official links", () => {
  const fq = parseFanqie(`<script>window.__INITIAL_STATE__={"home":{"editorList":[{"bookId":"7080092010052324352","bookName":"测试作品","author":"作者甲","category":"东方仙侠","abstract":"作品介绍"}]}};}</script>`, 123);
  assert.equal(fq[0].providerId, "7080092010052324352"); // 64-bit IDs must remain strings.
  assert.deepEqual(fq[0].tags, ["修仙"]);
  assert.equal(fq[0].source, "https://fanqienovel.com/page/7080092010052324352");
  const jj = parseJinjiang(`<table><tr><td><a href="oneauthor.php?authorid=9">作者乙</a></td><td><a href="onebook.php?novelid=123" title="简介：故事&#10;标签：成长 正剧">测试&lt;作品&gt;</a></td><td>原创-爱情</td></tr></table>`, 123);
  assert.equal(jj[0].title, "测试<作品>");
  assert.equal(jj[0].author, "作者乙");
  assert.deepEqual(jj[0].tags, ["情感", "成长"]);
  const k = parse17k(`<table><tr><td class="td2">[历史武侠]</td><td><a class="jt" href="//www.17k.com/book/88.html">书名</a><div><p>简介：故事</p></div></td><td class="td6">作者丙</td></tr></table>`, 123);
  assert.equal(k[0].id, "17k-88"); assert.deepEqual(k[0].tags, ["历史"]);
});
test("nested Zongheng links cannot turn a synopsis into another book or mix authors", () => {
  const zh = parseZongheng(`<section><div><a href="//www.zongheng.com/detail/42" title="正确书名">正确书名</a><a class="recommend-desc" href="//www.zongheng.com/detail/42" title="这是作品的简介">这是作品的简介</a><a href="//home.zongheng.com/show/userInfo/1.html">作者甲</a><a href="/categories?cateFineId=8104">科幻</a></div><div><a href="/detail/43" title="第二本">第二本</a><a href="//home.zongheng.com/show/userInfo/2.html">作者乙</a></div></section>`, 123);
  assert.equal(zh.length, 2); assert.equal(zh[0].title, "正确书名"); assert.equal(zh[1].author, "作者乙");
  assert.deepEqual(zh[0].tags, ["科幻"]);
});
test("category mappings do not invent reading style; missing categories yield finite rankings", () => {
  assert.deepEqual(mapTags("都市", []), []);
  const books = parseFanqie(`<script>window.__INITIAL_STATE__={"home":{"editorList":[{"bookId":"1","bookName":"小说","author":"作者","category":"都市"}]}};}</script>`, 1);
  assert.ok(recommend([{ ...books[0], id: "other", title: "另一部" }], books).every(r => Number.isFinite(r.score)));
});
test("cross-platform deduplication includes authors and preserves existing seed IDs", () => {
  const base = { id: "jjwxc-10", providerId: "10", platform: "jjwxc", title: "默读", author: "priest", genre: "悬疑", tags: ["悬疑"], description: "平台简介", color: "#123456", syncedAt: 20 };
  const catalog = mergeCatalog([base, { ...base, id: "17k-11", platform: "17k", syncedAt: 10 }, { ...base, id: "jjwxc-12", title: "同名书", author: "甲" }, { ...base, id: "jjwxc-13", title: "同名书", author: "乙" }]);
  assert.equal(catalog.filter(b => b.title === "默读").length, 1); assert.equal(catalog.find(b => b.title === "默读").id, "silent");
  assert.equal(catalog.find(b => b.title === "默读").tagOrigin, "curated");
  assert.equal(catalog.filter(b => b.title === "同名书").length, 2);
  assert.equal(uniqueBooks([base, { ...base, title: "错误重复标题" }]).length, 1);
});
test("real fetched snapshot has traceable records and accurately reports blocked sources", async () => {
  const snapshot = JSON.parse(await fs.readFile(new URL("../data/public-catalog.json", import.meta.url), "utf8"));
  assert.ok(snapshot.books.length >= 700); assert.equal(snapshot.coverage, "partial");
  assert.equal(new Set(snapshot.books.map(b => b.id)).size, snapshot.books.length);
  for (const b of snapshot.books) {
    assert.equal(b.metadataKind, "public"); assert.ok(b.title && b.author && b.syncedAt);
    assert.ok(new URL(b.source).protocol === "https:"); assert.match(b.providerId, /^\d+$/);
  }
  for (const source of snapshot.sources) assert.equal(source.count, snapshot.books.filter(b => b.platform === source.platform).length);
  assert.equal(snapshot.sources.find(s => s.platform === "qidian").count, 0);
  const catalog = mergeCatalog(snapshot.books);
  const external = catalog.find(b => b.platform === "fanqie");
  assert.equal((await validateFavorite({ id: external.id }, catalog)).source, external.source);
  await assert.rejects(validateFavorite({ id: external.id, source: "https://example.invalid/" }, catalog));
  assert.ok(recommend([external], catalog).some(r => r.book.platform === "jjwxc"));
});
test("an access challenge is reported as blocked and never imported as book data", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => { assert.equal(options.redirect, "manual"); return new Response('<meta name="aliyun_waf_aa">', { status: 200 }); };
    const result = await fetchSource("qimao"); assert.equal(result.state.status, "blocked"); assert.deepEqual(result.books, []);
  } finally { globalThis.fetch = original; }
});
