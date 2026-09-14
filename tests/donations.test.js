"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { createDonationsHandler } = require("../api/donations.js");

const LINK = "plink_DonationTest";
const NOW = Date.parse("2026-09-13T18:00:00Z");
const CONFIG = { paymentLinkId: LINK, checkoutUrl: "https://buy.stripe.com/example" };
const KEY = "rk_live_UnitTestOnly";

function session(id, overrides = {}) {
  return {
    id,
    payment_link: LINK,
    livemode: true,
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    currency: "usd",
    created: 1789200000,
    customer: { id: "cus_private", name: "Private Customer", email: "customer@example.com" },
    customer_details: { name: "Private Billing Name", email: "billing@example.com" },
    custom_fields: [],
    payment_intent: {
      id: `pi_${id}`,
      livemode: true,
      status: "succeeded",
      currency: "usd",
      latest_charge: {
        id: `ch_${id}`,
        livemode: true,
        paid: true,
        captured: true,
        status: "succeeded",
        currency: "usd",
        amount_captured: 2500,
        amount_refunded: 0,
        created: 1789200000,
        billing_details: { name: "Private Card Name", email: "card@example.com" }
      }
    },
    ...overrides
  };
}

function chargeSession(id, overrides) {
  const item = session(id);
  Object.assign(item.payment_intent.latest_charge, overrides);
  return item;
}

function page(data, hasMore = false) {
  return { ok: true, json: async () => ({ object: "list", data, has_more: hasMore }) };
}

function handler(options = {}) {
  return createDonationsHandler({
    env: { STRIPE_DONATIONS_READ_KEY: KEY },
    loadConfig: () => CONFIG,
    now: () => NOW,
    ...options
  });
}

async function request(run, method = "GET") {
  const res = {
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(body) { this.body = body; }
  };
  await run({ method, url: "/api/donations?payment_link=plink_Other" }, res);
  return { ...res, json: res.body ? JSON.parse(res.body) : undefined };
}

test("paginates the exact configured live link and publishes a complete total", async () => {
  const calls = [];
  const run = handler({ fetchImpl: async (url, options) => {
    calls.push({ url: new URL(url), options });
    return calls.length === 1 ? page([session("cs_first")], true) : page([session("cs_second")]);
  } });
  const result = await request(run);
  assert.equal(result.statusCode, 200);
  assert.equal(result.json.totalAmount, 5000);
  assert.equal(result.json.contributionCount, 2);
  assert.equal(result.json.currency, "usd");
  assert.equal(result.json.updatedAt, "2026-09-13T18:00:00.000Z");
  assert.equal(calls.length, 2);
  for (const { url, options } of calls) {
    assert.equal(url.origin, "https://api.stripe.com");
    assert.equal(url.searchParams.get("payment_link"), LINK);
    assert.equal(url.searchParams.get("status"), "complete");
    assert.equal(url.searchParams.get("limit"), "100");
    assert.equal(url.searchParams.get("expand[]"), "data.payment_intent.latest_charge");
    assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
    assert.equal(options.headers["Stripe-Version"], "2026-08-26.dahlia");
    assert.equal(options.redirect, "error");
    assert.equal(options.method, "GET");
  }
  assert.equal(calls[0].url.searchParams.has("starting_after"), false);
  assert.equal(calls[1].url.searchParams.get("starting_after"), "cs_first");
});

test("nets partial refunds and excludes fully refunded, unpaid, uncaptured, test and unrelated payments", async () => {
  const items = [
    chargeSession("cs_partial", { amount_captured: 10000, amount_refunded: 3500 }),
    chargeSession("cs_full", { amount_refunded: 2500 }),
    session("cs_unpaid", { payment_status: "unpaid" }),
    session("cs_free", { payment_status: "no_payment_required" }),
    session("cs_open", { status: "open" }),
    session("cs_test", { livemode: false }),
    session("cs_currency", { currency: "eur" }),
    session("cs_other", { payment_link: "plink_Unrelated" }),
    session("cs_subscription", { mode: "subscription" }),
    chargeSession("cs_uncaptured", { captured: false }),
    chargeSession("cs_failed", { status: "failed" }),
    chargeSession("cs_charge_test", { livemode: false }),
    chargeSession("cs_charge_currency", { currency: "eur" })
  ];
  const result = await request(handler({ fetchImpl: async () => page(items) }));
  assert.equal(result.statusCode, 200);
  assert.equal(result.json.totalAmount, 6500);
  assert.equal(result.json.contributionCount, 1);
  assert.deepEqual(result.json.contributions, [{ name: "Anonymous", amount: 6500, date: "2026-09-12" }]);
});

test("only a voluntary publicname field is published; private identities and IDs never escape", async () => {
  const named = session("cs_named", { custom_fields: [
    { key: "publicname", type: "text", optional: true, text: { value: "  Public   Alias\u202e " } }
  ] });
  const required = session("cs_required", { custom_fields: [
    { key: "publicname", type: "text", optional: false, text: { value: "Not Voluntary" } }
  ] });
  const wrongField = session("cs_wrong", { custom_fields: [
    { key: "name", type: "text", optional: true, text: { value: "Private Other Field" } }
  ] });
  const email = session("cs_email", { custom_fields: [
    { key: "publicname", type: "text", optional: true, text: { value: "oops@example.com" } }
  ] });
  const result = await request(handler({ fetchImpl: async () => page([named, required, wrongField, email, session("cs_anon")]) }));
  assert.deepEqual(result.json.contributions.map(item => item.name), ["Public Alias", "Anonymous", "Anonymous", "Anonymous", "Anonymous"]);
  for (const contribution of result.json.contributions) {
    assert.deepEqual(Object.keys(contribution).sort(), ["amount", "date", "name"]);
  }
  assert.doesNotMatch(result.body, /Private|Not Voluntary|example\.com|cs_|pi_|ch_|cus_|rk_live|customer|billing/);
  assert.deepEqual(Object.keys(result.json).sort(), ["contributionCount", "contributions", "currency", "totalAmount", "updatedAt"]);
});

test("an exact session privacy override hides the public name without changing donation totals", async () => {
  const anonymous = session("cs_live_OptedOut", {
    custom_fields: [
      { key: "publicname", type: "text", optional: true, text: { value: "Withdrawn Public Alias" } }
    ]
  });
  const named = session("cs_live_StillNamed", { custom_fields: [
    { key: "publicname", type: "text", optional: true, text: { value: "Another Public Donor" } }
  ] });
  const result = await request(handler({
    env: { STRIPE_DONATIONS_READ_KEY: KEY, DONATIONS_ANONYMOUS_SESSION_IDS: "cs_live_OptedOut" },
    fetchImpl: async () => page([anonymous, named])
  }));
  assert.equal(result.statusCode, 200);
  assert.equal(result.json.totalAmount, 5000);
  assert.equal(result.json.contributionCount, 2);
  assert.deepEqual(result.json.contributions, [
    { name: "Anonymous", amount: 2500, date: "2026-09-12" },
    { name: "Another Public Donor", amount: 2500, date: "2026-09-12" }
  ]);
  assert.doesNotMatch(result.body, /Withdrawn Public Alias|DONATIONS_ANONYMOUS_SESSION_IDS|cs_live_/);
});

test("privacy overrides do not match another session by public name or donation amount", async () => {
  const items = ["cs_live_Target", "cs_live_TargetOther"].map(id => session(id, {
    custom_fields: [
      { key: "publicname", type: "text", optional: true, text: { value: "Shared Public Alias" } }
    ]
  }));
  const result = await request(handler({
    env: { STRIPE_DONATIONS_READ_KEY: KEY, DONATIONS_ANONYMOUS_SESSION_IDS: "cs_live_Target" },
    fetchImpl: async () => page(items)
  }));
  assert.equal(result.statusCode, 200);
  assert.equal(result.json.contributionCount, items.length);
  assert.equal(result.json.totalAmount, 5000);
  assert.deepEqual(result.json.contributions.map(contribution => contribution.name), ["Anonymous", "Shared Public Alias"]);
});

test("invalid privacy override IDs fail closed without fetching Stripe or leaking IDs", async () => {
  for (const value of ["cs_test_Example", "cs_live_", "not-a-session", "cs_live_Valid,invalid",
    "cs_live_Invalid\nSuffix", "cs_live_Invalid?query=1"]) {
    const result = await request(handler({
      env: { STRIPE_DONATIONS_READ_KEY: KEY, DONATIONS_ANONYMOUS_SESSION_IDS: value },
      fetchImpl: async () => assert.fail("Invalid privacy configuration must not fetch Stripe")
    }));
    assert.equal(result.statusCode, 503);
    assert.deepEqual(result.json, { error: "Donation totals are temporarily unavailable." });
    assert.equal(result.headers["Cache-Control"], "no-store");
    assert.doesNotMatch(result.body, /cs_live_|cs_test_|privacy|session/);
  }
});

test("normalized privacy configuration changes bypass cached names before the normal TTL", async () => {
  const env = { STRIPE_DONATIONS_READ_KEY: KEY, DONATIONS_ANONYMOUS_SESSION_IDS: "  " };
  let calls = 0;
  const named = session("cs_live_PrivacyChange", { custom_fields: [
    { key: "publicname", type: "text", optional: true, text: { value: "Public Alias" } }
  ] });
  const run = handler({ env, fetchImpl: async () => { calls += 1; return page([named]); } });
  assert.equal((await request(run)).json.contributions[0].name, "Public Alias");
  assert.equal(calls, 1);

  env.DONATIONS_ANONYMOUS_SESSION_IDS = "cs_live_PrivacyChange,cs_live_Other";
  const privateResult = await request(run);
  assert.equal(privateResult.json.contributions[0].name, "Anonymous");
  assert.equal(privateResult.json.totalAmount, 2500);
  assert.equal(privateResult.json.contributionCount, 1);
  assert.equal(calls, 2, "adding a privacy override must not reuse a previously public snapshot");

  env.DONATIONS_ANONYMOUS_SESSION_IDS = " cs_live_Other , cs_live_PrivacyChange,cs_live_Other , ";
  assert.equal((await request(run)).json.contributions[0].name, "Anonymous");
  assert.equal(calls, 2, "equivalent sorted, deduplicated, trimmed IDs retain the same cache identity");

  env.DONATIONS_ANONYMOUS_SESSION_IDS = "";
  assert.equal((await request(run)).json.contributions[0].name, "Public Alias");
  assert.equal(calls, 3);
});

test("counts all contributions but returns only the latest 20 by charge date", async () => {
  const items = Array.from({ length: 25 }, (_, i) => chargeSession(`cs_${i}`, { created: 1789200000 + i * 86400 }));
  const result = await request(handler({ fetchImpl: async () => page(items) }));
  assert.equal(result.json.totalAmount, 62500);
  assert.equal(result.json.contributionCount, 25);
  assert.equal(result.json.contributions.length, 20);
  assert.equal(result.json.contributions[0].date, "2026-10-06");
  assert.equal(result.json.contributions[19].date, "2026-09-17");
});

test("returns genuine zero only after a successful empty Stripe list", async () => {
  const result = await request(handler({ fetchImpl: async () => page([]) }));
  assert.equal(result.statusCode, 200);
  assert.equal(result.json.totalAmount, 0);
  assert.equal(result.json.contributionCount, 0);
  assert.deepEqual(result.json.contributions, []);
});

test("missing or test credentials and invalid/missing config fail closed without fetching", async () => {
  for (const options of [
    { env: {} },
    { env: { STRIPE_DONATIONS_READ_KEY: "rk_test_Only" } },
    { loadConfig: () => ({}) },
    { loadConfig: () => ({ paymentLinkId: "https://example.com" }) },
    { loadConfig: () => { throw new Error("Missing config secret details"); } }
  ]) {
    const result = await request(handler({ ...options, fetchImpl: async () => assert.fail("Unexpected Stripe request") }));
    assert.equal(result.statusCode, 503);
    assert.deepEqual(result.json, { error: "Donation totals are temporarily unavailable." });
    assert.equal(result.headers["Cache-Control"], "no-store");
    assert.equal(result.headers["Retry-After"], "15");
  }
});

test("supports a server-only live secret fallback while preferring the restricted key", async () => {
  for (const [env, expected] of [
    [{ STRIPE_SECRET_KEY: "sk_live_Fallback" }, "sk_live_Fallback"],
    [{ STRIPE_DONATIONS_READ_KEY: KEY, STRIPE_SECRET_KEY: "sk_live_Fallback" }, KEY]
  ]) {
    const result = await request(handler({ env, fetchImpl: async (url, options) => {
      assert.equal(options.headers.Authorization, `Bearer ${expected}`);
      return page([]);
    } }));
    assert.equal(result.statusCode, 200);
  }
});

test("rejects write methods before loading config or calling Stripe", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
    const result = await request(handler({ loadConfig: () => assert.fail("Unexpected config access") }), method);
    assert.equal(result.statusCode, 405);
    assert.equal(result.headers.Allow, "GET, HEAD");
  }
});

test("HEAD reports availability with the same cache policy but no response body", async () => {
  const success = await request(handler({ fetchImpl: async () => page([]) }), "HEAD");
  assert.equal(success.statusCode, 200);
  assert.equal(success.body, undefined);
  assert.match(success.headers["Cache-Control"], /s-maxage=10/);
  const failure = await request(handler({ env: {} }), "HEAD");
  assert.equal(failure.statusCode, 503);
  assert.equal(failure.body, undefined);
});

test("a failed later page returns unavailable, never a partial total or a Stripe error body", async () => {
  let calls = 0;
  const run = handler({ fetchImpl: async () => {
    calls += 1;
    return calls === 1 ? page([session("cs_first")], true) : {
      ok: false,
      json: async () => assert.fail("Do not read Stripe error details")
    };
  } });
  const result = await request(run);
  assert.equal(calls, 2);
  assert.equal(result.statusCode, 503);
  assert.deepEqual(result.json, { error: "Donation totals are temporarily unavailable." });
  assert.equal(result.headers["Cache-Control"], "no-store");
  await request(run);
  assert.equal(calls, 2, "Failure cooldown avoids hammering Stripe");
});

test("invalid expansions, refunds, pages and repeated cursors cannot produce misleading totals", async () => {
  const invalidRefund = chargeSession("cs_refund", { amount_refunded: 5000 });
  const unexpanded = session("cs_unexpanded", { payment_intent: "pi_unexpanded" });
  const unexpandedCharge = session("cs_charge");
  unexpandedCharge.payment_intent.latest_charge = "ch_unexpanded";
  for (const fetchImpl of [
    async () => page([invalidRefund]),
    async () => page([unexpanded]),
    async () => page([unexpandedCharge]),
    async () => page([], true),
    async () => page([session("cs_loop")], true),
    async () => ({ ok: true, json: async () => ({ data: [] }) }),
    async () => { throw new Error("Stripe error containing private details"); }
  ]) {
    const result = await request(handler({ fetchImpl }));
    assert.equal(result.statusCode, 503);
    assert.deepEqual(result.json, { error: "Donation totals are temporarily unavailable." });
  }
});

test("the page bound fails explicitly instead of returning a partial total", async () => {
  let calls = 0;
  const result = await request(handler({ maxPages: 2, fetchImpl: async () => page([session(`cs_${++calls}`)], true) }));
  assert.equal(result.statusCode, 503);
  assert.equal(calls, 2);
});

test("the overall deadline aborts a slow Stripe call and exposes no timeout details", async () => {
  let signal;
  const result = await request(handler({ timeoutMs: 10, fetchImpl: async (url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  } }));
  assert.equal(signal.aborted, true);
  assert.equal(result.statusCode, 503);
  assert.deepEqual(result.json, { error: "Donation totals are temporarily unavailable." });
});

test("the default cache refreshes newly paid contributions after ten seconds", async () => {
  let time = NOW;
  let calls = 0;
  const run = handler({ now: () => time, fetchImpl: async () => {
    calls += 1;
    return page(calls === 1 ? [] : [session("cs_new_donation")]);
  } });
  assert.equal((await request(run)).json.totalAmount, 0);
  time += 9999;
  const cached = await request(run);
  assert.equal(cached.json.totalAmount, 0);
  assert.equal(calls, 1);
  time += 1;
  const refreshed = await request(run);
  assert.equal(calls, 2);
  assert.equal(refreshed.json.totalAmount, 2500);
  assert.equal(refreshed.json.contributionCount, 1);
});

test("coalesces simultaneous reads and caches only successes, then refreshes refund changes", async () => {
  let time = NOW;
  let calls = 0;
  let complete;
  const run = handler({ now: () => time, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return new Promise(resolve => { complete = () => resolve(page([session("cs_first")])); });
    return page([chargeSession("cs_first", { amount_refunded: 1000 })]);
  } });
  const first = request(run);
  const second = request(run);
  complete();
  const [a, b] = await Promise.all([first, second]);
  assert.equal(calls, 1);
  assert.deepEqual(a.json, b.json);
  time += 5000;
  const cached = await request(run);
  assert.equal(calls, 1);
  assert.match(cached.headers["Cache-Control"], /s-maxage=5/);
  time += 5001;
  const refreshed = await request(run);
  assert.equal(calls, 2);
  assert.equal(refreshed.json.totalAmount, 1500);
});

test("expired cached success is not returned as current during an upstream failure", async () => {
  let time = NOW;
  let calls = 0;
  const run = handler({ now: () => time, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return page([session("cs_first")]);
    if (calls === 2) throw new Error("upstream failed");
    return page([]);
  } });
  assert.equal((await request(run)).statusCode, 200);
  time += 10001;
  assert.equal((await request(run)).statusCode, 503);
  time += 15001;
  const recovered = await request(run);
  assert.equal(recovered.statusCode, 200);
  assert.equal(recovered.json.totalAmount, 0);
});
