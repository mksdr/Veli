const { test, expect } = require('@playwright/test');
const { createHash } = require('node:crypto');
const { buildSync } = require('esbuild');
const { staticServer } = require('../helpers/staticServer');

const cachePrefix = 'veli-offline-';
const oldCache = cachePrefix + 'old';
const sharedPath = '/shared.js';

function legacyWorker(version, precache) {
  return `
    const cacheName = ${JSON.stringify(cachePrefix + version)};
    const precache = ${JSON.stringify(precache)};
    self.addEventListener('install', event => event.waitUntil((async () => {
      const cache = await caches.open(cacheName);
      try {
        await cache.addAll(Object.entries(precache).map(([path, integrity]) =>
          new Request(new URL(path, self.location.origin), { cache: 'reload', integrity })));
      } catch (error) {
        await caches.delete(cacheName);
        for (const client of await self.clients.matchAll({ includeUncontrolled: true })) {
          client.postMessage({ installError: error.name });
        }
        throw error;
      }
    })()));
    self.addEventListener('fetch', event => {
      const path = new URL(event.request.url).pathname;
      const key = path === '/' ? '/index.html' : path;
      if (precache[key]) event.respondWith(caches.match(key, { cacheName }));
    });
  `;
}

function offlineWorker(version, precache, { withoutLocks = false } = {}) {
  const { outputFiles } = buildSync({
    stdin: {
      contents: `
        import { installOffline } from './service-worker/offline.ts';
        if (${withoutLocks}) Object.defineProperty(navigator, 'locks', { value: undefined });
        installOffline(self, ${JSON.stringify(precache)}, ${JSON.stringify(version)});
      `,
      resolveDir: process.cwd(),
    },
    target: 'es2020',
    bundle: true,
    write: false,
  });
  return outputFiles[0].contents;
}

function update(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    const result = new Promise(resolve => registration.addEventListener('updatefound', () => {
      const candidate = registration.installing;
      candidate.addEventListener('statechange', () => {
        if (['redundant', 'installed'].includes(candidate.state)) resolve(candidate.state);
      });
    }, { once: true }));
    await registration.update();
    return result;
  });
}

test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium exposes an origin quota override through CDP');

test('an update fits under quota by retaining the unchanged part of the legacy offline build', async ({ page, context }) => {
  const server = await staticServer();
  try {
    const html = version => `<!doctype html><title>${version}</title><script src="${sharedPath}"></script>`;
    const shared = 'window.sharedAssetLoaded = true; /*' + 'x'.repeat(512 * 1024) + '*/';
    const manifest = version => Object.fromEntries([['/index.html', html(version)], [sharedPath, shared]]
      .map(([path, body]) => [path, 'sha256-' + createHash('sha256').update(body).digest('base64')]));
    server.setFile('/probe.html', 'quota probe');
    server.setFile('/index.html', html('old'));
    server.setFile(sharedPath, shared);
    server.setFile('/service-worker.js', legacyWorker('old', manifest('old')));
    const probe = await context.newPage();
    await probe.goto(server.baseURL + '/probe.html');
    await page.goto(server.baseURL);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect(page).toHaveTitle('old');
    const cdp = await context.newCDPSession(probe);
    const { usage } = await cdp.send('Storage.getUsageAndQuota', { origin: server.baseURL });
    expect(usage).toBeGreaterThanOrEqual(512 * 1024);
    await cdp.send('Storage.overrideQuotaForOrigin', {
      origin: server.baseURL,
      quotaSize: Math.ceil(usage) + 128 * 1024,
    });

    server.setFile('/index.html', html('new'));
    server.setFile('/service-worker.js', legacyWorker('duplicate', manifest('new')));
    await page.evaluate(() => {
      navigator.serviceWorker.addEventListener('message', ({ data }) => {
        if (data.installError) window.installError = data.installError;
      });
    });
    expect(await update(page)).toBe('redundant');
    await expect.poll(() => page.evaluate(() => window.installError)).toBe('QuotaExceededError');
    await page.close();
    const stale = await context.newPage();
    await stale.goto(server.baseURL);
    await expect(stale).toHaveTitle('old');

    server.setFile('/service-worker.js', offlineWorker('new', manifest('new')));
    server.setFile(sharedPath, null);
    expect(await update(stale)).toBe('installed');
    await stale.reload();
    await expect(stale).toHaveTitle('old');
    expect(await stale.evaluate(() => window.sharedAssetLoaded)).toBe(true);
    expect(await stale.evaluate(async name => Boolean(await caches.match('/index.html', { cacheName: name })), oldCache)).toBe(true);
    await stale.close();

    await expect.poll(() => probe.evaluate(async name => Boolean(await caches.match('/index.html', { cacheName: name })), oldCache)).toBe(false);
    await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.goto(server.baseURL);
    await expect(reopened).toHaveTitle('new');
    expect(await reopened.evaluate(() => window.sharedAssetLoaded)).toBe(true);
  } finally {
    await server.close();
  }
});

test('updates without Web Locks prune obsolete caches and preserve active and waiting builds', async ({ page, context }) => {
  const server = await staticServer();
  const shared = 'window.sharedAssetLoaded = true;';
  const index = '/index.html';
  function deploy(version, { broken = false } = {}) {
    const html = `<!doctype html><title>${version}</title><script src="${sharedPath}"></script>`;
    const manifest = Object.fromEntries([[index, html], [sharedPath, shared]]
      .map(([path, body]) => [path, 'sha256-' + createHash('sha256').update(body).digest('base64')]));
    server.setFile(index, broken ? 'Mismatched deployment' : html);
    server.setFile('/service-worker.js', offlineWorker(version, manifest, { withoutLocks: true }));
  }
  const cacheKeys = () => page.evaluate(() => caches.keys());
  try {
    server.setFile('/probe.html', 'worker probe');
    server.setFile(sharedPath, shared);
    deploy('first');
    const probe = await context.newPage();
    await probe.goto(server.baseURL + '/probe.html');
    await page.goto(server.baseURL);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/service-worker.js');
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    expect(await page.evaluate(() => new Promise(resolve => {
      const channel = new MessageChannel();
      channel.port1.onmessage = ({ data }) => {
        if (data.repairing) return;
        channel.port1.close();
        resolve(data.ready);
      };
      navigator.serviceWorker.controller.postMessage({ cmd: 'getOfflineStatus', repair: true }, [channel.port2]);
    }))).toBe(true);
    await page.evaluate(() => caches.open('another-app').then(cache => cache.put('/unrelated', new Response('keep'))));
    server.setFile(sharedPath, null);

    for (const version of ['discarded', 'waiting']) {
      deploy(version);
      expect(await update(page)).toBe('installed');
    }
    expect(await cacheKeys()).toContain('veli-precache-discarded');

    deploy('broken', { broken: true });
    expect(await update(page)).toBe('redundant');
    expect((await cacheKeys()).sort()).toEqual([
      'another-app', 'veli-precache', 'veli-precache-first', 'veli-precache-waiting',
    ]);
    await page.reload();
    await expect(page).toHaveTitle('first');
    expect(await page.evaluate(() => window.sharedAssetLoaded)).toBe(true);

    await probe.evaluate(async () => {
      window.waitingWorker = (await navigator.serviceWorker.getRegistration()).waiting;
    });
    await page.close();
    await expect.poll(() => probe.evaluate(() => window.waitingWorker?.state)).toBe('activated');
    await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.goto(server.baseURL);
    await expect(reopened).toHaveTitle('waiting');
    expect(await reopened.evaluate(() => window.sharedAssetLoaded)).toBe(true);

    await context.setOffline(false);
    deploy('next');
    expect(await update(reopened)).toBe('installed');
    expect(await reopened.evaluate(async () => {
      const older = await caches.open('veli-precache-first');
      return (await older.keys()).map(request => new URL(request.url).pathname);
    })).toEqual([sharedPath]);
    expect(await reopened.evaluate(() => caches.has('another-app'))).toBe(true);
  } finally {
    await server.close();
  }
});
