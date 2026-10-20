import { COOKIE_NAME, readCookie, verifySessionToken } from "./api/_lib/admin-session.mjs";

// Vercel Routing Middleware: the directories are served only to signed-in admins.
// tools/dev-server.cjs runs this same function locally.
export const config = {
  matcher: ["/members", "/members.html", "/companies", "/companies.html"]
};

export default async function middleware(request) {
  const token = readCookie(request.headers.get("cookie"), COOKIE_NAME);
  if (await verifySessionToken(token, process.env.ADMIN_SESSION_SECRET)) return undefined;

  const url = new URL(request.url);
  const login = new URL("/admin-login", url);
  login.searchParams.set("next", url.pathname.replace(/\.html$/, ""));
  return Response.redirect(login, 302);
}
