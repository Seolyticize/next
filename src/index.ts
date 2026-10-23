import { createElement, type ReactElement } from "react";

/**
 * Seolyticize in a React app, in three exports.
 *
 * Plain React and standard Request/Response, nothing from Next itself, so the
 * same package works in Next (App or Pages Router), Remix, React Router and
 * anything else that renders React and answers web requests.
 */

export const DEFAULT_BASE_URL = "https://seolyticize.com";

export type AnalyticsProps = {
  /** The site key from set_up_web_analytics / onboard_site. */
  siteKey: string;
  /** Paths never reported, "*" matching anything: ["/app/*", "/verify"]. */
  exclude?: string[];
  /** When given, only these paths are reported. */
  include?: string[];
  /** Also record outbound-link clicks and/or file downloads as events. */
  track?: Array<"outbound" | "downloads">;
  /** Another deployment than seolyticize.com. */
  baseUrl?: string;
};

/**
 * The analytics tag. Put it once in the root layout (App Router:
 * app/layout.tsx; Pages Router: pages/_app.tsx). Cookieless; sends no query
 * string but utm_* tags; honours Do Not Track and Global Privacy Control.
 */
export function Analytics({
  siteKey,
  exclude,
  include,
  track,
  baseUrl = DEFAULT_BASE_URL,
}: AnalyticsProps): ReactElement {
  return createElement("script", {
    defer: true,
    src: `${baseUrl.replace(/\/$/, "")}/a.js`,
    "data-site": siteKey,
    ...(exclude?.length ? { "data-exclude": exclude.join(",") } : {}),
    ...(include?.length ? { "data-include": include.join(",") } : {}),
    ...(track?.length ? { "data-track": track.join(" ") } : {}),
  });
}

/**
 * Serves the IndexNow key file. In Next's App Router, put this in
 * app/<key>.txt/route.ts — `export const { GET } = indexNowKeyRoute("<key>")`
 * — so it answers at the site root exactly as IndexNow requires.
 */
export function indexNowKeyRoute(key: string): { GET: () => Response } {
  return {
    GET: () =>
      new Response(key, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=3600",
        },
      }),
  };
}

export type DeployNotification = {
  sitemaps?: string[];
  sitemapFound?: boolean;
  firstRun?: boolean;
  pagesKnown?: number;
  changed?: number;
  submitted?: number;
  result?: string;
  error?: string;
  code?: string;
};

/**
 * Tells Seolyticize a deploy finished, so the new and changed pages go to
 * IndexNow. hookUrl is what create_deploy_hook returned. With urls, exactly
 * those are submitted; without, the sitemap is compared with the last deploy.
 */
export async function notifyDeploy(
  hookUrl: string,
  options: { urls?: string[]; fetchImpl?: typeof fetch } = {},
): Promise<DeployNotification> {
  const response = await (options.fetchImpl ?? fetch)(hookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(options.urls ? { urls: options.urls } : {}),
  });
  const body = (await response.json().catch(() => ({}))) as DeployNotification;
  if (!response.ok) {
    throw new Error(body.error ?? `The deploy hook answered ${response.status}.`);
  }
  return body;
}
