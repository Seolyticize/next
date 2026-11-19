import { CLIENT } from "./version.js";

export type VerificationFile = { path: string; content: string };

function contentTypeFor(path: string): string {
  if (path.endsWith(".xml")) return "application/xml; charset=utf-8";
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  return "text/plain; charset=utf-8";
}

/**
 * Serves every verification file onboard_site issued for the site: the
 * IndexNow key file, Google's google….html and BingSiteAuth.xml, read by site
 * key from Seolyticize and kept `revalidate` seconds (Next's fetch cache too).
 * Any other path answers 404. In Next's App Router, one file answers them all:
 *
 *   // app/[file]/route.ts
 *   export const { GET } = seolyticizeVerificationRoute({ siteKey: "…" });
 *
 * A root-level dynamic segment cannot sit beside another one (an
 * app/[slug]/page.tsx); then re-export the same GET from static folders named
 * after each file, such as app/BingSiteAuth.xml/route.ts.
 */
export function seolyticizeVerificationRoute(options: {
  siteKey: string;
  baseUrl?: string;
  /** Seconds a fetched list is kept. Default 300. */
  revalidate?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}): { GET: (request: Request) => Promise<Response> } {
  const base = (options.baseUrl ?? "https://seolyticize.com").replace(/\/$/, "");
  const ttl = (options.revalidate ?? 300) * 1000;
  const now = options.now ?? Date.now;
  let kept: { files: VerificationFile[]; until: number } | null = null;

  const load = async (): Promise<VerificationFile[] | null> => {
    if (kept && kept.until > now()) return kept.files;
    try {
      const response = await (options.fetchImpl ?? fetch)(
        `${base}/api/verification-files?k=${encodeURIComponent(options.siteKey)}`,
        {
          headers: { "x-seolyticize-client": CLIENT },
          // Next's data cache; other runtimes ignore it.
          next: { revalidate: ttl / 1000 },
        } as RequestInit,
      );
      if (!response.ok) throw new Error(String(response.status));
      const body = (await response.json()) as { files?: VerificationFile[] };
      kept = { files: body.files ?? [], until: now() + ttl };
    } catch {
      // Seolyticize unreachable: the last list keeps answering, so a proof never goes missing.
      if (!kept) return null;
    }
    return kept.files;
  };

  return {
    GET: async (request) => {
      const path = new URL(request.url).pathname;
      const files = options.siteKey ? await load() : [];
      if (files === null) return new Response("Try again shortly.", { status: 503 });
      const file = files.find((entry) => entry.path === path);
      if (!file) return new Response("Not found.", { status: 404 });
      return new Response(file.content, {
        headers: {
          "content-type": contentTypeFor(file.path),
          "cache-control": "public, max-age=300",
        },
      });
    },
  };
}
