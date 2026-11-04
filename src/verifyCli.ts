#!/usr/bin/env node
import { verifySite } from "./index.js";

/**
 * seolyticize-verify [--site <domain> | --client <id>]: runs verify_site after
 * a deploy, prints one line per item that is not done, and exits 1 when any
 * failed, so a CI step can stop on it. Reads SEOLYTICIZE_API_KEY; without it,
 * or when Seolyticize cannot be reached, it says so and exits 0.
 */
const arg = (name: string) => {
  const at = process.argv.indexOf(name);
  return at === -1 ? undefined : process.argv[at + 1];
};
const apiKey = process.env["SEOLYTICIZE_API_KEY"];
const site = arg("--site") ?? process.env["SEOLYTICIZE_SITE"];
const clientId = arg("--client") ?? process.env["SEOLYTICIZE_CLIENT_ID"];
const baseUrl = process.env["SEOLYTICIZE_BASE_URL"];

if (!apiKey) {
  console.log("seolyticize: SEOLYTICIZE_API_KEY is not set; skipping verification.");
} else {
  verifySite({ apiKey, site, clientId, baseUrl })
    .then((check) => {
      for (const item of check.items.filter((one) => one.status !== "done")) {
        const next = item.next
          ? "action" in item.next
            ? item.next.action
            : `${item.next.tool} ${JSON.stringify(item.next.arguments)}`
          : "";
        console.log(
          `seolyticize: ${item.status} ${item.code ?? item.id}: ${item.detail}${next ? ` Next: ${next}` : ""}`,
        );
      }
      console.log(
        `seolyticize: ${check.domain ?? check.clientId} ${check.failed.length ? `${check.failed.length} failed` : check.ready ? "ready" : "nothing failed"}`,
      );
      // 10, as `seolyticize verify` in @seolyticize/cli: 1 there means an unexpected error.
      process.exitCode = check.failed.length ? 10 : 0;
    })
    .catch((error: unknown) =>
      console.log(
        `seolyticize: verification not run: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
}
