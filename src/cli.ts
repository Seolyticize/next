#!/usr/bin/env node
import { notifyDeploy } from "./index.js";

/**
 * seolyticize-notify-deploy: run after a deploy (a "postbuild" script, a CI
 * step). Reads the hook URL from SEOLYTICIZE_DEPLOY_HOOK. Never fails the
 * build: telling search engines is not worth breaking a deploy over.
 */
const hook = process.env["SEOLYTICIZE_DEPLOY_HOOK"];
if (!hook) {
  console.log(
    "seolyticize: SEOLYTICIZE_DEPLOY_HOOK is not set; skipping deploy notification.",
  );
} else {
  notifyDeploy(hook, {
    urls: process.argv.slice(2).filter((arg) => /^https?:\/\//.test(arg)),
  })
    .then((result) => console.log(`seolyticize: ${result.result ?? "notified"}`))
    .catch((error: unknown) =>
      console.log(
        `seolyticize: deploy notification failed: ${error instanceof Error ? error.message : String(error)}`,
      ),
    );
}
