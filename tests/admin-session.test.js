"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const SECRET = "unit-test-session-secret";
const NOW = Date.parse("2026-10-20T18:00:00Z");
const load = () => import("../api/_lib/admin-session.mjs");
const loadMiddleware = () => import("../middleware.js");
const loadLogin = () => import("../api/admin-login.mjs");

test("a signed session verifies until it expires", async () => {
  const { createSessionToken, verifySessionToken, SESSION_SECONDS } = await load();
  const token = await createSessionToken(SECRET, NOW);
  assert.equal(await verifySessionToken(token, SECRET, NOW), true);
  assert.equal(await verifySessionToken(token, SECRET, NOW + SESSION_SECONDS * 1000), false);
});

test("tampered, foreign, or missing sessions are rejected", async () => {
  const { createSessionToken, verifySessionToken } = await load();
  const token = await createSessionToken(SECRET, NOW);
  const [expiresAt, signature] = token.split(".");
  assert.equal(await verifySessionToken(`${Number(expiresAt) + 9999}.${signature}`, SECRET, NOW), false);
  assert.equal(await verifySessionToken(token, "another-secret", NOW), false);
  assert.equal(await verifySessionToken(token, undefined, NOW), false);
  assert.equal(await verifySessionToken(null, SECRET, NOW), false);
  assert.equal(await verifySessionToken("garbage", SECRET, NOW), false);
});

test("password comparison and post-login destinations", async () => {
  const { passwordMatches, safeNextPath } = await load();
  assert.equal(await passwordMatches("correct horse", "correct horse"), true);
  assert.equal(await passwordMatches("correct hors", "correct horse"), false);
  assert.equal(safeNextPath("/companies"), "/companies");
  assert.equal(safeNextPath("https://evil.example"), "/members");
  assert.equal(safeNextPath(null), "/members");
});

test("middleware sends visitors without a session to the login page", async () => {
  process.env.ADMIN_SESSION_SECRET = SECRET;
  const { default: middleware } = await loadMiddleware();
  const response = await middleware(new Request("https://example.com/companies.html"));
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "https://example.com/admin-login?next=%2Fcompanies");

  const { createSessionToken, COOKIE_NAME } = await load();
  const token = await createSessionToken(SECRET);
  const allowed = await middleware(new Request("https://example.com/members", {
    headers: { cookie: `other=1; ${COOKIE_NAME}=${token}` }
  }));
  assert.equal(allowed, undefined);
});

test("login sets a session cookie only for the right password", async () => {
  process.env.ADMIN_PASSWORD = "correct horse";
  process.env.ADMIN_SESSION_SECRET = SECRET;
  const { POST } = await loadLogin();
  const post = password => POST(new Request("https://example.com/api/admin-login", {
    method: "POST",
    body: new URLSearchParams({ password, next: "/companies" })
  }));

  const wrong = await post("nope");
  assert.equal(wrong.headers.get("location"), "/admin-login?error=password&next=/companies");
  assert.equal(wrong.headers.get("set-cookie"), null);

  const right = await post("correct horse");
  assert.equal(right.status, 303);
  assert.equal(right.headers.get("location"), "/companies");
  assert.match(right.headers.get("set-cookie"), /^shp_admin=\d+\.[\w-]+; Path=\/; HttpOnly; SameSite=Lax; Max-Age=43200; Secure$/);
});
