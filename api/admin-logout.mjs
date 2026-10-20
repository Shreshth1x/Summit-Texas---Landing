import { cookieHeader, redirect } from "./_lib/admin-session.mjs";

export function POST(request) {
  return redirect("/admin-login", cookieHeader(request, "", 0));
}
