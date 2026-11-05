"use client";
import { useEffect, useState } from "react";

type Tag = ((command: "visit") => Promise<string | null> | null) & { q?: unknown };

/**
 * This visit's token from the analytics tag, or null while there is none: no
 * consent, Do Not Track or Global Privacy Control, an excluded path, or the tag
 * not loaded. Null again from the page's stub, which only queues.
 */
export async function currentVisit(
  tag: unknown = (globalThis as { seolyticize?: unknown }).seolyticize,
): Promise<string | null> {
  if (typeof tag !== "function" || (tag as Tag).q) return null;
  return (await (tag as Tag)("visit")) ?? null;
}

/**
 * The token for a sign-up on another host: pass it along in a form field, then
 * send it from your server with createCollector().trackLater({ name, visit }).
 * Asks again for 30 seconds, since the tag and a consent grant both come later.
 */
export function useVisit(): string | null {
  const [visit, setVisit] = useState<string | null>(null);
  useEffect(() => {
    let tries = 0;
    const timer = setInterval(() => {
      if (++tries >= 60) clearInterval(timer);
      void currentVisit().then((token) => {
        if (!token) return;
        clearInterval(timer);
        setVisit(token);
      });
    }, 500);
    return () => clearInterval(timer);
  }, []);
  return visit;
}
