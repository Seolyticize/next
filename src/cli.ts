#!/usr/bin/env node
import { DEFAULT_BASE_URL, notifyDeploy, waitForLive } from "./index.js";

/**
 * seolyticize-notify-deploy: run once the new version serves (a deploy script,
 * a CI step after the deploy). Reads SEOLYTICIZE_DEPLOY_HOOK_ID (or the hook's
 * URL from SEOLYTICIZE_DEPLOY_HOOK or SEOLYTICIZE_DEPLOY_HOOK_URL) and
 * SEOLYTICIZE_DEPLOY_HOOK_SECRET, and prints none of them. Never fails the build:
 * telling search engines is not worth breaking a deploy over. --verbose lists the URLs compared and
 * those found changed. --strict, --source=<name> and --ref=<free text> (default
 * SOURCE_COMMIT or GIT_COMMIT) send what create_deploy_hook's howToCall sends;
 * a busy hook (503) is retried once after Retry-After. --wait-for <url> first
 * polls until that page answers 200 (with --wait-header name=value, until that
 * header has that value) for up to --wait-timeout seconds (300), and skips the
 * call when it never does.
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
// --name=value, or --name value for the flags that take one.
const spaced = ["wait-for", "wait-header", "wait-timeout"];
const flag = (name: string) => {
  const at = args.indexOf(`--${name}`);
  if (at >= 0 && spaced.includes(name)) return args[at + 1];
  return args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
};
const values = new Set(
  args.flatMap((arg, at) => (spaced.includes(arg.slice(2)) ? [at + 1] : [])),
);
const waitFor = flag("wait-for");
const waitHeader = flag("wait-header");
const headerAt = waitHeader?.indexOf("=") ?? -1;
const waitSeconds = Number(flag("wait-timeout") ?? 300);

async function main(target: string) {
  if (waitFor) {
    const waited = await waitForLive(waitFor, {
      timeoutMs:
        (Number.isFinite(waitSeconds) && waitSeconds > 0 ? waitSeconds : 300) * 1000,
      ...(waitHeader && headerAt > 0
        ? {
            header: {
              name: waitHeader.slice(0, headerAt).trim(),
              value: waitHeader.slice(headerAt + 1).trim(),
            },
          }
        : {}),
    });
    if (!waited.live) {
      console.log(
        `seolyticize: ${waitFor} did not serve the new version within ${waitSeconds} s (last: ${waited.last}); deploy notification skipped.`,
      );
      return;
    }
  }
  const result = await notifyDeploy(target, {
    urls: args.filter((arg, at) => !values.has(at) && /^https?:\/\//.test(arg)),
    ...(secret ? { secret } : {}),
    verbose,
    strict: args.includes("--strict"),
    source: flag("source"),
    ref: flag("ref") ?? process.env["SOURCE_COMMIT"] ?? process.env["GIT_COMMIT"],
  });
  console.log(
    `seolyticize: ${result.result ?? "notified"}${result.compared ? ` (compared by ${result.compared})` : ""}`,
  );
  if (verbose) {
    for (const url of result.changedUrls ?? []) console.log(`  changed  ${url}`);
    console.log(`  ${result.comparedUrls?.length ?? 0} URLs compared`);
  }
}

if (!hook) {
  console.log(
    "seolyticize: SEOLYTICIZE_DEPLOY_HOOK_ID (or SEOLYTICIZE_DEPLOY_HOOK_URL) is not set; skipping deploy notification.",
  );
} else {
  main(hook).catch((error: unknown) =>
    console.log(
      // A malformed URL's error quotes it, and it may hold the secret.
      `seolyticize: deploy notification failed: ${(error instanceof Error ? error.message : String(error)).replaceAll(hook, "<the hook URL>")}`,
    ),
  );
}
