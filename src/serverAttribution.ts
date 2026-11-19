/**
 * Sign-ups and Stripe purchases credited to their visit, in one call each.
 * Keys come from SEOLYTICIZE_SITE_KEY and SEOLYTICIZE_SERVER_COLLECT_KEY
 * unless passed; the logic is the SDK's (one implementation for every package).
 */
import {
  checkoutMetadata,
  createCollector,
  hashUserId,
  recordStripeEvent as sdkRecordStripeEvent,
  reportSignup as sdkReportSignup,
  type Collector,
  type CollectorOptions,
  type StripeEventLike,
  type TrackResult,
} from "@seolyticize/sdk";
import { CLIENT } from "./version.js";

export type ReportOptions = Partial<CollectorOptions>;

let warnedNoKeys = false;

/** A collector from the options, or the environment; null (said once) without keys. */
function collectorFrom(
  options: ReportOptions,
): { collector: Collector; siteKey: string } | null {
  const siteKey = options.siteKey ?? process.env.SEOLYTICIZE_SITE_KEY;
  const serverKey = options.serverKey ?? process.env.SEOLYTICIZE_SERVER_COLLECT_KEY;
  if (!siteKey || !serverKey) {
    if (!warnedNoKeys) {
      warnedNoKeys = true;
      console.warn(
        "[seolyticize] SEOLYTICIZE_SITE_KEY and SEOLYTICIZE_SERVER_COLLECT_KEY are not set: nothing is reported.",
      );
    }
    return null;
  }
  return {
    collector: createCollector({ client: CLIENT, ...options, siteKey, serverKey }),
    siteKey,
  };
}

/**
 * Reports a sign-up for the visitor behind this request (its address, user
 * agent and page, or the page's seolyticize("visit") token in an
 * X-Seolyticize-Visit header) and resolves with the visit token, to keep with
 * the account if later events should be credited to it. userId is sent only
 * as a salted SHA-256 (hashUserId); leave it out without the user's consent.
 * Never rejects.
 *
 *   await reportSignup(request, { userId: claims.sub });
 */
export async function reportSignup(
  request: Request,
  options: ReportOptions & {
    userId?: string | undefined;
    props?: Record<string, string | number | boolean> | undefined;
  } = {},
): Promise<string | null> {
  const { userId, props, ...rest } = options;
  const found = collectorFrom(rest);
  if (!found) return null;
  const uid = userId ? await hashUserId(found.siteKey, userId) : undefined;
  return sdkReportSignup(found.collector, request, { uid, props });
}

/**
 * { seolyticize_visit: "<token>" } for the visitor behind this request, to
 * spread into stripe.checkout.sessions.create({ metadata }); {} when none.
 */
export async function seolyticizeCheckoutMetadata(
  request: Request,
  options: ReportOptions = {},
): Promise<Record<string, string>> {
  const found = collectorFrom(options);
  return found ? checkoutMetadata(found.collector, request) : {};
}

/**
 * Call with every event your Stripe webhook verified: a paid
 * checkout.session.completed becomes a Purchase (amount_total in minor units,
 * the currency as is, the session id as orderId) credited to the visit in its
 * metadata, or unattributed without one. Null for any other event.
 */
export async function recordStripeEvent(
  event: StripeEventLike,
  options: ReportOptions = {},
): Promise<TrackResult | null> {
  const found = collectorFrom(options);
  return found ? sdkRecordStripeEvent(found.collector, event) : null;
}
