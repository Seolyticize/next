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
npm install github:Seolyticize/next
```
