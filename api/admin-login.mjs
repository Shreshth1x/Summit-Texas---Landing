import {
  SESSION_SECONDS, cookieHeader, createSessionToken, passwordMatches, redirect, safeNextPath
} from "./_lib/admin-session.mjs";

// Server-only: ADMIN_PASSWORD and ADMIN_SESSION_SECRET live in Vercel env vars.
export async function POST(request) {
  const form = await request.formData().catch(() => null);
  const next = safeNextPath(form?.get("next"));
  const password = form?.get("password");
  const { ADMIN_PASSWORD: expected, ADMIN_SESSION_SECRET: secret } = process.env;

  if (!expected || !secret) return redirect(`/admin-login?error=config&next=${next}`);
  if (typeof password !== "string" || !(await passwordMatches(password, expected))) {
    return redirect(`/admin-login?error=password&next=${next}`);
  }

  const token = await createSessionToken(secret);
  return redirect(next, cookieHeader(request, token, SESSION_SECONDS));
}
