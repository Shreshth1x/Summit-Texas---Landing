"use strict";

// Server-only: the browser receives only the explicitly selected public fields.
// Restricted key permissions: Checkout Sessions, PaymentIntents, and Charges (read).
// https://docs.stripe.com/api/versioning
// https://docs.stripe.com/api/checkout/sessions/list
// https://docs.stripe.com/expand
// https://docs.stripe.com/api/charges/object
const STRIPE_VERSION = "2026-08-26.dahlia";
const UNAVAILABLE = { error: "Donation totals are temporarily unavailable." };

function loadDonationConfig() {
  // A literal require also lets Vercel include this file in the function bundle.
  return require("../config/donations.json");
}

function publicName(session, anonymousSessionIds) {
  // Site-owned privacy overrides match exact sessions, never names or amounts.
  if (anonymousSessionIds.has(session.id)) return "Anonymous";
  const field = Array.isArray(session.custom_fields)
    ? session.custom_fields.find(item => item.key === "publicname" && item.type === "text" && item.optional === true)
    : null;
  if (!field || typeof field.text?.value !== "string") return "Anonymous";

  const name = field.text.value.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, "")
    .replace(/\s+/g, " ").trim().slice(0, 60);
  // A donor's billing name/email is never a fallback. Avoid publishing an email
  // accidentally entered into the optional public-name field, too.
  return name && !name.includes("@") ? name : "Anonymous";
}

function contributionFrom(session, paymentLinkId, anonymousSessionIds) {
  const linkId = typeof session.payment_link === "string" ? session.payment_link : session.payment_link?.id;
  if (linkId !== paymentLinkId || session.livemode !== true || session.mode !== "payment" ||
      session.status !== "complete" || session.payment_status !== "paid" || session.currency !== "usd") return null;

  const intent = session.payment_intent;
  // A failed expansion must not silently turn a confirmed payment into zero.
  if (!intent || typeof intent !== "object") throw new Error("Missing payment expansion");
  if (intent.livemode !== true || intent.status !== "succeeded" || intent.currency !== "usd") return null;
  const charge = intent.latest_charge;
  if (!charge || typeof charge !== "object") throw new Error("Missing charge expansion");
  if (charge.livemode !== true || charge.paid !== true || charge.captured !== true ||
      charge.status !== "succeeded" || charge.currency !== "usd") return null;

  const captured = charge.amount_captured;
  const refunded = charge.amount_refunded;
  if (!Number.isSafeInteger(captured) || captured < 0 || !Number.isSafeInteger(refunded) ||
      refunded < 0 || refunded > captured) throw new Error("Invalid payment amounts");
  const amount = captured - refunded;
  if (amount === 0) return null;
  if (!Number.isSafeInteger(charge.created) || charge.created <= 0) throw new Error("Invalid payment date");
  const date = new Date(charge.created * 1000);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid payment date");
  return { name: publicName(session, anonymousSessionIds), amount, date: date.toISOString().slice(0, 10), created: charge.created };
}

async function readAllDonations({ paymentLinkId, secret, anonymousSessionIds, fetchImpl, now, signal, maxPages }) {
  let startingAfter;
  let totalAmount = 0;
  let contributionCount = 0;
  const latest = [];
  const seen = new Set();

  for (let page = 0; page < maxPages; page += 1) {
    signal.throwIfAborted();
    const url = new URL("https://api.stripe.com/v1/checkout/sessions");
    url.searchParams.set("payment_link", paymentLinkId);
    url.searchParams.set("status", "complete");
    url.searchParams.set("limit", "100");
    url.searchParams.append("expand[]", "data.payment_intent.latest_charge");
    if (startingAfter) url.searchParams.set("starting_after", startingAfter);

    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: { Authorization: `Bearer ${secret}`, "Stripe-Version": STRIPE_VERSION },
      signal,
      redirect: "error"
    });
    if (!response.ok) throw new Error("Stripe request unavailable");
    const list = await response.json();
    signal.throwIfAborted();
    if (!list || !Array.isArray(list.data) || typeof list.has_more !== "boolean" || list.data.length > 100) {
      throw new Error("Invalid Stripe page");
    }

    for (const session of list.data) {
      if (!session || typeof session.id !== "string" || !session.id || seen.has(session.id)) {
        throw new Error("Invalid Stripe pagination");
      }
      seen.add(session.id);
      const contribution = contributionFrom(session, paymentLinkId, anonymousSessionIds);
      if (!contribution) continue;
      totalAmount += contribution.amount;
      if (!Number.isSafeInteger(totalAmount)) throw new Error("Donation total exceeds safe range");
      contributionCount += 1;
      latest.push(contribution);
      latest.sort((a, b) => b.created - a.created);
      if (latest.length > 20) latest.pop();
    }

    if (!list.has_more) {
      return {
        currency: "usd",
        totalAmount,
        contributionCount,
        updatedAt: new Date(now()).toISOString(),
        contributions: latest.map(({ name, amount, date }) => ({ name, amount, date }))
      };
    }
    if (!list.data.length) throw new Error("Invalid empty continuation page");
    startingAfter = list.data[list.data.length - 1].id;
  }
  // Never report a partial total when the data exceeds this request's budget.
  throw new Error("Donation pagination limit reached");
}

function createDonationsHandler({
  env = process.env,
  loadConfig = loadDonationConfig,
  fetchImpl = (...args) => fetch(...args),
  now = Date.now,
  timeoutMs = 8000,
  cacheTtlMs = 10000,
  failureCooldownMs = 15000,
  maxPages = 100
} = {}) {
  let cache;
  let inFlight;
  let failure;

  async function snapshot(scope) {
    if (cache?.scope === scope.id && cache.expiresAt > now()) return cache;
    if (inFlight?.scope === scope.id) return inFlight.promise;
    if (failure?.scope === scope.id && failure.retryAt > now()) throw new Error("Retry later");

    const work = { scope: scope.id };
    work.promise = (async () => {
      const controller = new AbortController();
      let timer;
      const deadline = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error("Donation request timed out"));
        }, timeoutMs);
      });
      try {
        const data = await Promise.race([
          readAllDonations({ ...scope, fetchImpl, now, signal: controller.signal, maxPages }),
          deadline
        ]);
        cache = { scope: scope.id, data, expiresAt: now() + cacheTtlMs };
        failure = undefined;
        return cache;
      } catch (error) {
        failure = { scope: scope.id, retryAt: now() + failureCooldownMs };
        throw error;
      } finally {
        clearTimeout(timer);
        if (inFlight === work) inFlight = undefined;
      }
    })();
    inFlight = work;
    return work.promise;
  }

  return async function donations(req, res) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Method not allowed." }));
      return;
    }

    try {
      const { paymentLinkId } = loadConfig() || {};
      const secret = (env.STRIPE_DONATIONS_READ_KEY || env.STRIPE_SECRET_KEY || "").trim();
      const anonymousIds = [...new Set((env.DONATIONS_ANONYMOUS_SESSION_IDS || "")
        .split(",").map(id => id.trim()).filter(Boolean))].sort();
      if (!/^plink_[a-zA-Z0-9]+$/.test(paymentLinkId || "") || !/^(rk|sk)_live_[a-zA-Z0-9]+$/.test(secret)) {
        throw new Error("Donation counter is not configured");
      }
      if (anonymousIds.some(id => !/^cs_live_[a-zA-Z0-9]+$/.test(id))) {
        throw new Error("Invalid donation privacy configuration");
      }
      const result = await snapshot({
        paymentLinkId, secret,
        anonymousSessionIds: new Set(anonymousIds),
        id: `${paymentLinkId}:${secret}:${anonymousIds.join(",")}`
      });
      const remainingSeconds = Math.max(0, Math.floor((result.expiresAt - now()) / 1000));
      res.setHeader("Cache-Control", `public, max-age=0, s-maxage=${remainingSeconds}, must-revalidate`);
      res.statusCode = 200;
      res.end(req.method === "HEAD" ? undefined : JSON.stringify(result.data));
    } catch {
      // Do not expose Stripe bodies, exception messages, keys, or customer data.
      res.setHeader("Retry-After", "15");
      res.statusCode = 503;
      res.end(req.method === "HEAD" ? undefined : JSON.stringify(UNAVAILABLE));
    }
  };
}

module.exports = createDonationsHandler();
module.exports.createDonationsHandler = createDonationsHandler;
