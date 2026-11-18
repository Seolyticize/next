/**
 * Server-side collection, from @seolyticize/sdk (one implementation for
 * both packages); createCollector here names this package as the sender.
 */
import {
  createCollector as sdkCreateCollector,
  type Collector,
  type CollectorOptions,
} from "@seolyticize/sdk";
import { CLIENT } from "./version.js";

export {
  addressFrom,
  classifyAgent,
  collectInMiddleware,
  DEFAULT_ALLOWED_PARAMS,
  DEFAULT_COLLECT_URL,
  expressCollector,
  isPageRequest,
  stripQuery,
} from "@seolyticize/sdk";
export type {
  Collector,
  CollectorOptions,
  LaterEvent,
  PageView,
  TrackResult,
} from "@seolyticize/sdk";

export function createCollector(options: CollectorOptions): Collector {
  return sdkCreateCollector({ client: CLIENT, ...options });
}
