/// <reference lib="webworker" />

import { offlineCache } from "./offline-cache.ts";

const pages: Record<string, string> = {
  "/": "/index.html",
  "/headless": "/headless/index.html",
  "/headless/": "/headless/index.html",
  "/generate-keys": "/generate-keys/index.html",
  "/generate-keys/": "/generate-keys/index.html",
};

// Pages hosts may redirect /index.html to / (and /offline.html to /offline).
// Safari rejects a response with that redirect history for navigation requests
// whose redirect mode is manual. Rewrap only the final body, without buffering.
function withoutRedirectHistory(response: Response): Response {
  return response.redirected
    ? new Response(response.body, { status: response.status, statusText: response.statusText, headers: response.headers })
    : response;
}

export function installOffline(scope: ServiceWorkerGlobalScope, precache: Record<string, string>, version: string): void {
  const paths = Object.keys(precache);
  if (!paths.length) return;
  const allowed = new Set(paths);
  const storage = offlineCache(scope, precache, version);
  const readCached = async (path: string) => {
    try {
      return await storage.match(await storage.open(), path);
    } catch {
      // An unreadable cache is a miss. The network may still be available.
      return undefined;
    }
  };
  let repair: Promise<void> | undefined;

  scope.addEventListener("install", event => {
    // The first worker can serve streaming downloads before its offline cache is ready.
    // An update must prepare its cache before it can replace the active worker.
    if (!scope.registration.active) return;
    event.waitUntil(storage.prepare());
  });
  scope.addEventListener("activate", event => {
    event.waitUntil(storage.cleanUp().catch(() => {
      // Cache Storage errors must not prevent the worker from taking control.
    }));
  });
  scope.addEventListener("message", event => {
    const port = event.ports[0];
    if (event.data?.cmd !== "getOfflineStatus" || !port) return;
    event.waitUntil((async () => {
      let ready = false;
      try {
        const missing = await storage.missingPaths(await storage.open());
        ready = missing.length === 0;
        if (!ready && event.data.repair === true) {
          port.postMessage({ repairing: true });
          // Initial preparation and repair both require this worker's build.
          repair ??= storage.repair()
            .finally(() => { repair = undefined; });
          await repair;
          ready = (await storage.missingPaths(await storage.open())).length === 0;
        }
      } catch {
        // Keep surviving entries and let the next online visit retry.
      }
      port.postMessage({ ready });
    })());
  });
  scope.addEventListener("fetch", event => {
    const url = new URL(event.request.url);
    if (url.origin !== scope.location.origin || event.request.method !== "GET" || url.pathname === "/file") return;
    if (event.request.mode === "navigate" && /^\/about\/?$/.test(url.pathname)) {
      event.respondWith(fetch(new Request(event.request, { cache: "no-store" })).catch(async () =>
        await readCached("/offline.html") ?? Response.error()).then(withoutRedirectHistory));
      return;
    }
    const navigating = event.request.mode === "navigate";
    const key = navigating ? pages[url.pathname] : url.pathname;
    if (!key || !allowed.has(key)) return;
    if (navigating) {
      event.respondWith((async () => {
        let cached: Response | undefined;
        try {
          const build = await storage.open();
          cached = await storage.match(build, key);
          if (cached && (await storage.missingPaths(build)).length === 0) return withoutRedirectHistory(cached);
        } catch {
          // An unreadable cache may still have a usable page if the network fails.
        }
        // A newer deployment may no longer serve the old page's missing chunks.
        try {
          const response = await fetch(event.request, { cache: "reload" });
          return withoutRedirectHistory(response.status >= 400 && cached ? cached : response);
        } catch (error) {
          if (!cached) throw error;
          return withoutRedirectHistory(cached);
        }
      })());
      return;
    }
    event.respondWith((async () => {
      const cached = await readCached(key);
      // Never cache arbitrary runtime requests, including credentials or downloads.
      return withoutRedirectHistory(cached ?? await fetch(event.request));
    })());
  });
}
