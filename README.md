# @seolyticize/next

Seolyticize in Next.js — and any React framework — in three exports.

```tsx
// app/layout.tsx
import { Analytics } from "@seolyticize/next";

<Analytics siteKey="…" exclude={["/app/*", "/verify", "/reset"]} />;
```

```ts
// app/<your IndexNow key>.txt/route.ts
import { indexNowKeyRoute } from "@seolyticize/next";
export const { GET } = indexNowKeyRoute("<your IndexNow key>");
```

```jsonc
// package.json — tell search engines after every deploy
"scripts": { "postbuild": "seolyticize-notify-deploy" }
// with SEOLYTICIZE_DEPLOY_HOOK set to the URL from create_deploy_hook
```

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
