/// <reference lib="webworker" />

const prefix = "veli-offline-";
const pages: Record<string, string> = {
  "/": "/index.html",
  "/headless": "/headless/index.html",
  "/headless/": "/headless/index.html",
  "/generate-keys": "/generate-keys/index.html",
  "/generate-keys/": "/generate-keys/index.html",
};

export function installOffline(scope: ServiceWorkerGlobalScope, precache: string[], version: string): void {
  if (!precache.length) return;
  const cacheName = prefix + version;
  const allowed = new Set(precache);
  scope.addEventListener("install", event => {
    event.waitUntil((async () => {
      const cache = await caches.open(cacheName);
      try {
        // Fetch with revalidation disabled so a deployment cannot reuse stale HTML.
        await cache.addAll(precache.map(url => new Request(new URL(url, scope.location.origin), { cache: "reload" })));
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
    if (event.data?.cmd !== "getOfflineStatus") return;
    event.waitUntil((async () => {
      const cache = await caches.open(cacheName);
      const keys = new Set((await cache.keys()).map(request => new URL(request.url).pathname));
      event.ports[0]?.postMessage({ ready: precache.every(url => keys.has(url)) });
    })());
  });
  scope.addEventListener("fetch", event => {
    const url = new URL(event.request.url);
    if (url.origin !== scope.location.origin || event.request.method !== "GET" || url.pathname === "/file") return;
    if (event.request.mode === "navigate" && /^\/about\/?$/.test(url.pathname)) {
      event.respondWith(fetch(new Request(event.request, { cache: "no-store" })).catch(async () =>
        (await caches.open(cacheName)).match("/offline.html").then(response => response ?? Response.error())));
      return;
    }
    const key = event.request.mode === "navigate" ? pages[url.pathname] : url.pathname;
    if (!key || !allowed.has(key)) return;
    event.respondWith((async () => {
      const cached = await (await caches.open(cacheName)).match(key);
      // Never cache arbitrary runtime requests, including credentials or downloads.
      return cached ?? fetch(event.request);
    })());
  });
}
