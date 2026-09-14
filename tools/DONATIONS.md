# Donations

The Donate page links to the one-time, donor-selected USD Payment Link in
`config/donations.json`. This is separate from the membership product.

`api/donations.js` is a Vercel Node function. It reads only completed, paid,
live Checkout Sessions belonging to that exact Payment Link. Totals use
captured amounts minus refunds, before processing fees. Fully refunded
contributions are omitted. The total covers all contributions; the list
shows the latest 20. Sessions are paginated completely or the request fails
without publishing a partial total.

The server requires the sensitive Vercel environment variable
`STRIPE_DONATIONS_READ_KEY`. The dedicated restricted key needs read access to
Checkout Sessions, Payment Intents, and Charges and Refunds. The variable is
configured for Production and Preview. Never place the key in source files,
public JavaScript, or this document.

Only the optional Stripe custom field `publicname` supplies public names.
The checkout explains that donation amounts appear publicly and donors can
leave that field blank to appear as Anonymous. Billing names, emails,
customer IDs, and transaction IDs are never sent to the browser.

The page polls every 10 seconds while visible and checks immediately on window
focus, browser-history restoration, and visibility changes. Overlapping checks
share the active request. The server caches successful responses for 10 seconds,
so new paid donations normally appear within about 10–20 seconds. Missing
credentials or Stripe failures return 503;
the page keeps its last confirmed totals and marks them as unavailable to
refresh, or shows a dash if nothing has loaded yet. A successful empty Stripe
response is the only way to show zero.

Stripe currently displays its hosted thank-you confirmation after payment.
This works independently of whether the new website routes are deployed.

Validation:

```sh
node --test tests/donations.test.js tests/donate-ui.test.js
python3 tools/check-links.py
vercel build --yes
```

Publishing the website requires a Vercel deployment containing the new pages,
styles, scripts, API function, and configuration. There is no webhook or
database to provision. The Stripe product and Payment Link already exist in
live mode; do not create duplicates when deploying the website.

## Local development

Run `node tools/dev-server.cjs` to serve the site and the donation API at
`http://127.0.0.1:4179/donate`. Hosted checkout can take payments even when the
local counter has no credential, so verify `/api/donations` returns HTTP 200
before treating the local page as connected.

The local server reads `.env.local`, then `.env.donations.local`. Keep a dedicated
live restricted read key in `STRIPE_DONATIONS_READ_KEY` in the latter file so a
Vercel development environment pull cannot overwrite it. The local key needs
only Read on Checkout Sessions, Payment Intents, and Charges and Refunds. Store
the file with mode 0600; both Git and Vercel ignore `.env*`, and the local server
rejects requests for dotfiles. Restart the server after changing the credential.

Vercel sensitive variables are write-only. Pulling Production variables returns
a redacted placeholder for the donation key, not a usable local credential.
Keep the existing hosted key and local key separate.
