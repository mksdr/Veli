/// <reference lib="webworker" />

const legacyPrefix = "veli-offline-";
const buildPrefix = "veli-precache-";
const coordinationName = "veli-precache";
const indexPath = "/.veli-precache-index";

type AssetLinks = Record<string, string>;
type BuildCache = { cache: Cache; links: AssetLinks };

async function hasIntegrity(response: Response, integrity: string): Promise<boolean> {
  const digest = await crypto.subtle.digest("SHA-256", await response.arrayBuffer());
  return integrity === "sha256-" + btoa(String.fromCharCode(...new Uint8Array(digest)));
}

export function offlineCache(scope: ServiceWorkerGlobalScope, precache: Record<string, string>, version: string) {
  const paths = Object.keys(precache);
  const cacheName = buildPrefix + version;
  const locks = scope.navigator?.locks;
  const withLock = (task: () => Promise<void>) => locks ? locks.request(coordinationName, task) : task();
  const request = (path: string) =>
    new Request(new URL(path, scope.location.origin), { cache: "reload", integrity: precache[path] });

  async function open(): Promise<BuildCache> {
    const cache = await caches.open(cacheName);
    const index = await cache.match(indexPath);
    return { cache, links: index ? await index.json() as AssetLinks : {} };
  }

  async function match({ cache, links }: BuildCache, path: string) {
    const local = await cache.match(path);
    const cacheName = links[path];
    return local ?? (cacheName ? await caches.match(path, { cacheName }) : undefined);
  }

  async function missingPaths({ cache, links }: BuildCache) {
    const cachedPaths = (requests: readonly Request[]) => new Set(requests.map(key => new URL(key.url).pathname));
    const local = cachedPaths(await cache.keys());
    const linked = new Map<string, Set<string>>();
    for (const name of new Set(Object.values(links))) {
      if (await caches.has(name)) linked.set(name, cachedPaths(await (await caches.open(name)).keys()));
    }
    return paths.filter(path => !local.has(path) && !linked.get(links[path])?.has(path));
  }

  function prepare() {
    return withLock(async () => {
      // A waiting legacy worker may still activate and remove legacy caches.
      const canReuseLegacy = !scope.registration.waiting && scope.registration.active?.state !== "activating";
      const names = await caches.keys();
      const sources = names.filter(name => name !== cacheName &&
        (name.startsWith(buildPrefix) || (canReuseLegacy && name.startsWith(legacyPrefix))));
      const cache = await caches.open(cacheName);
      const links: AssetLinks = {};
      const missing: string[] = [];
      let added = false;
      try {
        for (const path of paths) {
          if (await cache.match(path)) continue;
          for (const name of sources) {
            const response = await caches.match(path, { cacheName: name });
            if (response && await hasIntegrity(response, precache[path])) {
              links[path] = name;
              break;
            }
          }
          if (!links[path]) missing.push(path);
        }
        // addAll is atomic and checks integrity against the current deployment.
        if (missing.length) {
          await cache.addAll(missing.map(request));
          added = true;
        }
        await cache.put(indexPath, new Response(JSON.stringify(links)));
        const coordination = await caches.open(coordinationName);
        await coordination.put(indexPath, new Response(cacheName));
      } catch (error) {
        try {
          if (!names.includes(cacheName)) await caches.delete(cacheName);
          else if (added) for (const path of missing) await cache.delete(path);
        } catch {
          // Preserve the original failure when storage is also unavailable during rollback.
        }
        throw error;
      }
    });
  }

  function cleanUp() {
    // A worker without Web Locks can reuse assets but cannot safely prune them
    // while a newer worker may be preparing references to those assets.
    if (!locks) return Promise.resolve();
    return withLock(async () => {
      const latest = await caches.match(indexPath, { cacheName: coordinationName });
      if (!latest || await latest.text() !== cacheName) return;
      const build = await open();
      if ((await missingPaths(build)).length) return;
      for (const name of await caches.keys()) {
        if (name === cacheName || !(name.startsWith(buildPrefix) || name.startsWith(legacyPrefix))) continue;
        const keep = new Set(paths.filter(path => build.links[path] === name));
        if (!keep.size) {
          await caches.delete(name);
          continue;
        }
        const cache = await caches.open(name);
        for (const key of await cache.keys()) {
          if (!keep.has(new URL(key.url).pathname)) await cache.delete(key);
        }
      }
    });
  }

  function repair() {
    return withLock(async () => {
      const build = await open();
      const missing = await missingPaths(build);
      if (missing.length) await build.cache.addAll(missing.map(request));
    });
  }

  return { open, match, missingPaths, prepare, cleanUp, repair };
}
