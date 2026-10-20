# Admin login and directories

`/members` and `/companies` are visible only to admins. `middleware.js`
(Vercel Routing Middleware) checks a signed session cookie on every request
and sends everyone else to `/admin-login`. Admins share one password.
Sessions last 12 hours; **Log out** on either directory ends one early.

## Setup

Add two **sensitive** environment variables in Vercel (Project → Settings →
Environment Variables) for Production and Preview, then redeploy:

- `ADMIN_PASSWORD`: the shared admin password. Use a long passphrase; there is
  no lockout after failed attempts.
- `ADMIN_SESSION_SECRET`: a random value that signs sessions. Generate one with
  `openssl rand -base64 32`. It is never typed in anywhere.

Changing `ADMIN_SESSION_SECRET` signs every admin out. Changing only
`ADMIN_PASSWORD` keeps existing sessions until they expire.

For local preview, put both values in `.env.admin.local` (ignored by git) and
restart `node tools/dev-server.cjs`.

Never put either value in source files or this document.

## Adding directory entries

Each directory page (`members.html`, `companies.html`) has a commented-out
template inside `<ul class="directory__list">`. Copy it once per person or
company, uncomment it, and fill it in. The "No members added yet." line hides
itself once the list has an entry.
