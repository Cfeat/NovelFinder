import test from "node:test";
import assert from "node:assert/strict";
import { parseProfile, emptyProfile } from "../lib/reader-profile.ts";
import { novels } from "../lib/novels.ts";
import { isLocalRequest } from "../lib/local-request.ts";

test("reader interests, exclusions, favorites and feedback survive a persisted round-trip", () => {
  const profile = { ...emptyProfile(), favorites: [novels[0]], preferredTags: ["悬疑"], blockedTags: ["竞技"], exploration: "explore", feedback: [{ book: novels[1], kind: "read", at: 123 }] };
  assert.deepEqual(parseProfile(JSON.stringify(profile)), profile);
  assert.deepEqual(parseProfile(null), emptyProfile());
});
test("corrupt or unsupported stored data is rejected instead of silently overwriting the book list", () => {
  assert.throws(() => parseProfile("not json"));
  assert.throws(() => parseProfile(JSON.stringify({ ...emptyProfile(), version: 2 })));
  assert.throws(() => parseProfile(JSON.stringify({ ...emptyProfile(), favorites: [{ ...novels[0], source: "javascript:alert(1)" }] })));
  assert.throws(() => parseProfile(JSON.stringify({ ...emptyProfile(), preferredTags: ["made up"] })));
  const profile = parseProfile(JSON.stringify({ ...emptyProfile(), preferredTags: ["科幻", "科幻"], blockedTags: ["科幻"] }));
  assert.deepEqual(profile.preferredTags, []);
});
test("public metadata operations accept only loopback request hosts", () => {
  for (const origin of ["http://127.0.0.1:5173", "http://localhost:5173", "http://[::1]:5173"]) assert.ok(isLocalRequest(new Request(origin)));
  for (const origin of ["https://example.com", "https://localhost.evil.test", "http://192.168.1.10", "https://example.com/localhost"]) assert.equal(isLocalRequest(new Request(origin)), false);
});
