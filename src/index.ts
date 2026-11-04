import { createElement, type ReactElement } from "react";

/**
 * Seolyticize in a React app, in three exports.
 *
 * Plain React and standard Request/Response, nothing from Next itself, so the
 * same package works in Next (App or Pages Router), Remix, React Router and
 * anything else that renders React and answers web requests.
 */

export const DEFAULT_BASE_URL = "https://seolyticize.com";

/**
 * Content-Security-Policy origins by install path, the same as
 * /.well-known/seolyticize-embed.json: <Analytics> (the a.js tag) needs both,
 * events posted from the page's own code need connect-src only.
 */
export function cspFor(baseUrl: string = DEFAULT_BASE_URL) {
  const origin = new URL(baseUrl).origin;
  return {
    tag: { "script-src": [origin], "connect-src": [origin] },
    beaconOnly: { "connect-src": [origin] },
  };
}
export const csp = cspFor();

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
  /**
   * How the tag waits for consent. Nothing is stored on the visitor's device
   * either way (no cookies, no storage), so many sites need none.
   * - "gcm": follows Google Consent Mode's analytics_storage, which most consent
   *   banners send (consentType names another storage type).
   * - "required": sends nothing until window.seolyticize("consent", true), for
   *   any banner: call it from the banner's own callback.
   * - true / false: the page already knows; false renders nothing.
   * - left out or "none": always sends.
   */
  consent?: boolean | "gcm" | "required" | "none";
  /** The Consent Mode storage type to follow with consent="gcm" (default analytics_storage). */
  consentType?: string;
  /** A CSP nonce, put on the script tag. */
  nonce?: string;
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
  consent,
  consentType,
  nonce,
}: AnalyticsProps): ReactElement | null {
  if (consent === false) return null;
  const waits = consent === "required" || consent === "gcm";
  return createElement("script", {
    defer: true,
    src: `${baseUrl.replace(/\/$/, "")}/a.js`,
    "data-site": siteKey,
    ...(waits ? { "data-consent": consent } : {}),
    ...(consent === "gcm" && consentType ? { "data-consent-type": consentType } : {}),
    ...(nonce ? { nonce } : {}),
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
  /** What a change was judged by: a moved lastmod, or only new URLs (no lastmod in the sitemap). */
  compared?: "lastmod" | "new_urls_only" | "listed_urls";
  /** With verbose: the URLs compared and the ones found changed. */
  comparedUrls?: string[];
  changedUrls?: string[];
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
  options: {
    urls?: string[];
    verbose?: boolean;
    /** The same query create_deploy_hook's howToCall sends: strict=1, source, ref. */
    strict?: boolean;
    source?: string;
    ref?: string;
    fetchImpl?: typeof fetch;
    /** Waits before the one retry; a test passes a no-op. */
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<DeployNotification> {
  const query = new URLSearchParams();
  if (options.verbose) query.set("verbose", "1");
  if (options.strict) query.set("strict", "1");
  if (options.source) query.set("source", options.source);
  if (options.ref) query.set("ref", options.ref.slice(0, 100));
  const target = query.size
    ? `${hookUrl}${hookUrl.includes("?") ? "&" : "?"}${query}`
    : hookUrl;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise((done) => setTimeout(done, ms)));
  const send = () =>
    (options.fetchImpl ?? fetch)(target, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(options.urls ? { urls: options.urls } : {}),
    });
  let response = await send();
  // One retry when the hook is busy, after the wait it asks for (capped at two minutes).
  if (response.status === 503) {
    const wait = Number(response.headers.get("retry-after") ?? 60);
    await sleep(Math.min(Number.isFinite(wait) ? wait : 60, 120) * 1000);
    response = await send();
  }
  const body = (await response.json().catch(() => ({}))) as DeployNotification;
  if (!response.ok) {
    throw new Error(body.error ?? `The deploy hook answered ${response.status}.`);
  }
  return body;
}

export type SiteCheck = {
  clientId: string;
  domain: string | null;
  ready: boolean;
  items: Array<{
    id: string;
    status: string;
    code?: string;
    detail: string;
    next: { tool: string; arguments: unknown } | { action: string } | null;
  }>;
};

/**
 * Runs verify_site for a client (or the client whose site is on `site`), with
 * an API key. What seolyticize-verify prints; `failed` is what a CI step fails on.
 */
export async function verifySite(options: {
  apiKey: string;
  clientId?: string;
  site?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<SiteCheck & { failed: SiteCheck["items"] }> {
  const base = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const call = async <T>(tool: string, input: unknown): Promise<T> => {
    const response = await (options.fetchImpl ?? fetch)(`${base}/api/v1/tools/${tool}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const body = (await response.json().catch(() => ({}))) as {
      data?: T;
      error?: string;
    };
    if (!response.ok)
      throw new Error(body.error ?? `${tool} answered ${response.status}.`);
    return body.data as T;
  };
  let clientId = options.clientId;
  if (!clientId) {
    if (!options.site) throw new Error("Pass a clientId or a site domain.");
    const found = await call<{ clients: Array<{ id: string }> }>("list_clients", {
      domain: options.site,
    });
    clientId = found.clients[0]?.id;
    if (!clientId) throw new Error(`No client has the site ${options.site}.`);
  }
  const check = await call<SiteCheck>("verify_site", { clientId });
  return { ...check, failed: check.items.filter((item) => item.status === "failed") };
}
