# @seolyticize/next

Seolyticize in Next.js — and any React framework — in three exports.

```tsx
// app/layout.tsx
import { Analytics } from "@seolyticize/next";

<Analytics siteKey="…" exclude={["/app/*", "/verify", "/reset"]} />;
```

**What it stores:** nothing. No cookies, no localStorage, sessionStorage or
IndexedDB, no identifier on the device; a visitor is a daily-salted hash
counted on the server, and Do Not Track and Global Privacy Control are honoured.
A consent manager can list it as cookieless. The same facts, keyless, are at
https://seolyticize.com/.well-known/seolyticize-embed.json, and what a privacy
notice needs (retention, hosting, sub-processors) at
https://seolyticize.com/.well-known/processor.json.

`siteKey` is the public key from `get_web_analytics_setup` (the tag's
`data-site-key`), not the internal `site_…` id in crawl ids.

**Version.** Every request (the tag, the server collector, the deploy bin) names
this package and version (`X-Seolyticize-Client: next/0.4.2`, or `data-client`
on the tag), so `get_next_steps` shows an `upgrade_client` row when an older
install is still reporting.

**Consent.** The tag sets nothing on the device and sends from the first page;
whether your site needs consent for it is your call. Gating it is an extra you
choose, and counts then start only after a grant:

```tsx
<Analytics siteKey="…" consent="banner-gated" />  // or "gcm": follows Google Consent Mode's analytics_storage
<Analytics siteKey="…" consent="required" />  // waits for window.seolyticize("consent", true)
<Analytics siteKey="…" consent={granted} />   // the page already knows: false renders nothing
```

`consent="banner-gated"` works with every banner that sends Google Consent Mode
(`consentType` follows another storage type; `debug` says on the console why the tag is not sending). Otherwise call
`seolyticize("consent", true)` / `false` from the banner's own callback.
Custom events: `window.seolyticize("Signup", { plan: "free" })`.

**CSP:** `nonce={nonce}` puts the nonce on the tag, and the origins come as constants:

```ts
import { csp } from "@seolyticize/next";
// csp.tag:        { "script-src": ["https://seolyticize.com"], "connect-src": ["https://seolyticize.com"] }
// csp.beaconOnly: { "connect-src": ["https://seolyticize.com"] } — events posted from your own code
```

```ts
// app/<your IndexNow key>.txt/route.ts
import { indexNowKeyRoute } from "@seolyticize/next";
export const { GET } = indexNowKeyRoute("<your IndexNow key>");
```

Tell search engines after every deploy with `seolyticize-notify-deploy`, with
`SEOLYTICIZE_DEPLOY_HOOK_ID` and `SEOLYTICIZE_DEPLOY_HOOK_SECRET` from
`create_deploy_hook` (or `SEOLYTICIZE_DEPLOY_HOOK_URL` set to a URL that holds
its secret). Call it after the new version serves, not before: IndexNow fetches
the pages as soon as they are submitted, and would read the old ones. Where
that is depends on how you ship:

| How you ship                             | Where the call goes                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git build on Coolify                     | Configuration → Post-deployment command (`get_deploy_hook`'s `howToCall.coolify`).                                                                            |
| A prebuilt image, rolled out by a script | The deploy script, after the rollout: `npx seolyticize-notify-deploy --wait-for https://example.com/ --wait-header x-version=$TAG --source=deploy --ref=$TAG` |
| GitHub Actions                           | A step after the deploy step, `if: success()`.                                                                                                                |
| Vercel                                   | Not `postbuild` (Vercel builds before it serves): a Vercel webhook on `deployment.succeeded`, or a GitHub Actions job on `deployment_status`.                 |
| `next build && next start` on one host   | `"postbuild"` is too early; call it after the server restarts.                                                                                                |

`--ref` is free text: a tag, a commit or a build number, up to 100 characters.
`--wait-for <url>` polls that page every 5 s until it answers 200 (and, with
`--wait-header name=value`, until that header has that value, such as a version
header the new build sets), for up to `--wait-timeout <seconds>` (default 300),
then calls the hook; if the page never gets there, it skips the call and says so.

`seolyticize-notify-deploy --strict --source=deploy` sends the same request as
`create_deploy_hook`'s `howToCall`: `?strict=1&source=deploy&ref=<commit>`, with
`--ref` defaulting to `SOURCE_COMMIT` or `GIT_COMMIT`. A busy hook (503) is
retried once after its `Retry-After`. It never prints the id, URL or secret.
`waitForLive(url, {header})` and `notifyDeploy(hookUrl, {...})` do the same from code.

The answer says what it compared by: `lastmod`, or `new_urls_only` when the
sitemap has no `<lastmod>` (then only new pages are found). `--verbose` lists
the URLs compared and those found changed.

```sh
# fail a CI step when verify_site has a failed item
SEOLYTICIZE_API_KEY=… npx seolyticize-verify --site example.com
```

`seolyticize-verify` prints one line per item not done (its code and the fix)
and exits 10 when any item failed, the same code as `seolyticize verify` in
`@seolyticize/cli` (where 1 means an unexpected error). Without a key, or when Seolyticize cannot be
reached, it says so and exits 0.

The site key and IndexNow key come from `onboard_site` (https://seolyticize.com/AGENTS.md).

## Install

```sh
npm install @seolyticize/next
```

## Server-side collection

For pages the tag cannot see — AI assistants (ChatGPT-User, Claude-User,
Perplexity-User) read pages without running JavaScript — or for sites that
would rather not run a tag at all. Needs the server key from
`issue_server_collect_key`; keep it in an environment variable, never in a
client bundle.

```ts
// middleware.ts (Next.js)
import type { NextFetchEvent, NextRequest } from "next/server";
import { collectInMiddleware, createCollector } from "@seolyticize/next/server";

const collector = createCollector({
  siteKey: "…",
  serverKey: process.env.SEOLYTICIZE_SERVER_KEY!,
  // With the <Analytics /> tag installed too, report only what the tag cannot
  // see, or every person is counted twice.
  only: "agents",
  exclude: ["/api/*", "/admin/*"],
});

export function middleware(request: NextRequest, event: NextFetchEvent) {
  collectInMiddleware(collector, request, event);
}
```

```ts
// Express, Connect or plain Node http
import { createCollector, expressCollector } from "@seolyticize/next/server";
app.use(
  expressCollector(
    createCollector({ siteKey: "…", serverKey: process.env.SEOLYTICIZE_SERVER_KEY! }),
  ),
);
```

What is sent: the path with only the `utm_*` parameters (change with
`allowParams`), the referrer's origin, and the visitor's address, user agent
and country. Seolyticize hashes the address and user agent under a salt that
is deleted daily and stores neither. Bots are dropped before anything is
sent; AI assistants are reported, and counted apart from people.

## Revenue attribution

To credit orders to the visit they came from, send a reference from the
checkout page and put the same reference in the order's metadata:

```ts
seolyticize("event", "Checkout", { ref: cartId });
// Stripe:  metadata: { seolyticize_ref: cartId }   (Checkout Session or PaymentIntent)
// Shopify: a cart attribute named seolyticize_ref
// Paddle:  custom_data: { seolyticize_ref: cartId }
```

The reference is your own (a cart id, or the order id itself sent as
`order_id`), so nothing about the visitor travels with it. Orders without one
are attributed from their own UTM tags and landing page where the store
recorded them.

## Conversions after the visit

A payment confirmed by webhook an hour later, or a trial that converts next
week, happens when the visitor is long gone. Ask for the visit's token while
they are still there, keep it on your server with the account or order (never
in a cookie or the page), and send the later event with it:

```ts
// At sign-up, with the visitor's own agent and address:
const visit = await collector.trackForVisit({
  url: request.url,
  name: "Signup",
  userAgent: request.headers.get("user-agent"),
  ip: addressFrom(request.headers),
});
await db.accounts.update(account.id, { seolyticizeVisit: visit });

// Days later, from the payment webhook:
await collector.trackLater({
  visit: account.seolyticizeVisit,
  name: "Top-up",
  props: { value: 25 },
});
```

The later event is credited to the visit's landing page, source and campaign,
so goals, funnels and `get_conversions` count it there. A token lasts 35
days. For orders, `record_order` takes the same token as `visit`.
