#!/usr/bin/env node
import { DEFAULT_BASE_URL, notifyDeploy } from "./index.js";

/**
 * seolyticize-notify-deploy: run after a deploy (a "postbuild" script, a CI
 * step). Reads SEOLYTICIZE_DEPLOY_HOOK_ID (or the hook's URL from
 * SEOLYTICIZE_DEPLOY_HOOK or SEOLYTICIZE_DEPLOY_HOOK_URL) and
 * SEOLYTICIZE_DEPLOY_HOOK_SECRET, and prints none of them. Never fails the build:
 * telling search engines is not worth breaking a deploy over. --verbose lists the URLs compared and
 * those found changed. --strict, --source=<name> and --ref=<commit> (default
 * SOURCE_COMMIT or GIT_COMMIT) send what create_deploy_hook's howToCall sends;
 * a busy hook (503) is retried once after Retry-After.
 */
const hookId = process.env["SEOLYTICIZE_DEPLOY_HOOK_ID"];
const secret = process.env["SEOLYTICIZE_DEPLOY_HOOK_SECRET"];
const hook =
  process.env["SEOLYTICIZE_DEPLOY_HOOK"] ??
  process.env["SEOLYTICIZE_DEPLOY_HOOK_URL"] ??
  (hookId
    ? `${(process.env["SEOLYTICIZE_BASE_URL"] ?? DEFAULT_BASE_URL).replace(/\/$/, "")}/api/v1/hooks/deploy/${hookId}`
    : undefined);
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const flag = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
if (!hook) {
  console.log(
    "seolyticize: SEOLYTICIZE_DEPLOY_HOOK_ID (or SEOLYTICIZE_DEPLOY_HOOK_URL) is not set; skipping deploy notification.",
  );
} else {
  notifyDeploy(hook, {
    urls: args.filter((arg) => /^https?:\/\//.test(arg)),
    ...(secret ? { secret } : {}),
    verbose,
    strict: args.includes("--strict"),
    source: flag("source"),
    ref: flag("ref") ?? process.env["SOURCE_COMMIT"] ?? process.env["GIT_COMMIT"],
  })
    .then((result) => {
      console.log(
        `seolyticize: ${result.result ?? "notified"}${result.compared ? ` (compared by ${result.compared})` : ""}`,
      );
      if (verbose) {
        for (const url of result.changedUrls ?? []) console.log(`  changed  ${url}`);
        console.log(`  ${result.comparedUrls?.length ?? 0} URLs compared`);
      }
    })
    .catch((error: unknown) =>
      console.log(
        // A malformed URL's error quotes it, and it may hold the secret.
        `seolyticize: deploy notification failed: ${(error instanceof Error ? error.message : String(error)).replaceAll(hook, "<the hook URL>")}`,
      ),
    );
}
