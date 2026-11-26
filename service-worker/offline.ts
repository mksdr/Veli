/// <reference lib="webworker" />

const prefix = "veli-offline-";
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
  const cacheName = prefix + version;
  const allowed = new Set(paths);
  const request = (path: string, integrity?: string) =>
    new Request(new URL(path, scope.location.origin), { cache: "reload", integrity });
  const missingPaths = async (cache: Cache) => {
    const keys = new Set((await cache.keys()).map(request => new URL(request.url).pathname));
    return paths.filter(path => !keys.has(path));
  };
  const readCached = async (path: string) => {
    try {
      return await (await caches.open(cacheName)).match(path);
    } catch {
      // An unreadable cache is a miss. The network may still be available.
      return undefined;
    }
  };
  let repair: Promise<void> | undefined;

  scope.addEventListener("install", event => {
    event.waitUntil((async () => {
      const cache = await caches.open(cacheName);
      try {
        // Fetch with revalidation disabled so a deployment cannot reuse stale HTML.
        await cache.addAll(paths.map(path => request(path)));
      } catch (error) {
        await caches.delete(cacheName);
        throw error;
      }
    })());
  });
  scope.addEventListener("activate", event => {
    event.waitUntil((async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith(prefix) && key !== cacheName) await caches.delete(key);
      }
    })());
  });
  scope.addEventListener("message", event => {
    const port = event.ports[0];
    if (event.data?.cmd !== "getOfflineStatus" || !port) return;
    event.waitUntil((async () => {
      let ready = false;
      try {
        const cache = await caches.open(cacheName);
        const missing = await missingPaths(cache);
        ready = missing.length === 0;
        if (!ready && event.data.repair === true) {
          port.postMessage({ repairing: true });
          // An active worker may serve an older build while an update waits.
          // Only restore responses whose bytes match this worker's build.
          repair ??= cache.addAll(missing.map(path => request(path, precache[path])))
            .finally(() => { repair = undefined; });
          await repair;
          ready = (await missingPaths(await caches.open(cacheName))).length === 0;
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
    const key = event.request.mode === "navigate" ? pages[url.pathname] : url.pathname;
    if (!key || !allowed.has(key)) return;
    event.respondWith((async () => {
      const cached = await readCached(key);
      // Never cache arbitrary runtime requests, including credentials or downloads.
      return withoutRedirectHistory(cached ?? await fetch(event.request));
    })());
  });
}
