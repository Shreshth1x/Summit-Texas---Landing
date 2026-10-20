// Shared by middleware.js and the admin login/logout functions. Web Crypto only,
// so it runs in both the Edge (middleware) and Node (functions) runtimes.
export const COOKIE_NAME = "shp_admin";
export const SESSION_SECONDS = 12 * 60 * 60;
export const PROTECTED_PATHS = ["/members", "/companies"];

const encoder = new TextEncoder();

function base64url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

async function sign(secret, message) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

async function digest(value) {
  return base64url(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

export async function passwordMatches(input, expected) {
  // Hash both sides first so the comparison length never depends on the input.
  return constantTimeEqual(await digest(input), await digest(expected));
}

export async function createSessionToken(secret, now = Date.now()) {
  const expiresAt = Math.floor(now / 1000) + SESSION_SECONDS;
  return `${expiresAt}.${await sign(secret, `admin.${expiresAt}`)}`;
}

export async function verifySessionToken(token, secret, now = Date.now()) {
  if (typeof token !== "string" || !secret) return false;
  const [expiresAt, signature] = token.split(".");
  if (!/^\d+$/.test(expiresAt || "") || !signature) return false;
  if (Number(expiresAt) <= Math.floor(now / 1000)) return false;
  return constantTimeEqual(signature, await sign(secret, `admin.${expiresAt}`));
}

export function readCookie(header, name) {
  for (const part of (header || "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

export function cookieHeader(request, value, maxAge) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

// Only ever send an admin back to a directory, never to an arbitrary URL.
export function safeNextPath(value) {
  return PROTECTED_PATHS.includes(value) ? value : PROTECTED_PATHS[0];
}

export function redirect(location, cookie) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}
