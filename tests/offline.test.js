const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installOffline } = require('../service-worker/offline.ts');
const precache = {
  '/index.html': 'sha256-home',
  '/headless/index.html': 'sha256-headless',
  '/offline.html': 'sha256-offline',
};

function harness(version = 'new') {
  const handlers = {};
  const stores = new Map();
  const deleted = [];
  const batches = [];
  let failFetch = false;
  const scope = { location: { origin: 'https://veli.test' }, addEventListener(type, handler) { handlers[type] = handler; } };
  global.caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name);
      return {
        async addAll(requests) {
          batches.push(requests);
          if (failFetch) throw new Error('Network lost');
          for (const request of requests) {
            data.set(new URL(request.url).pathname, new Response('cached'));
          }
        },
        async keys() { return [...data.keys()].map(url => new Request('https://veli.test' + url)); },
        async match(key) {
          const original = data.get(key);
          if (!original) return;
          const copy = original.clone();
          // CacheStorage preserves redirect history, unlike Response.clone in
          // this lightweight test double with synthetic metadata.
          Object.defineProperty(copy, 'redirected', { value: original.redirected });
          return copy;
        },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
  };
  installOffline(scope, precache, version);
  async function event(type, extra = {}) {
    let task;
    handlers[type]({ ...extra, waitUntil(promise) { task = promise; } });
    return task;
  }
  function fetch(url, options = {}) {
    let response;
    const request = new Request(new URL(url, scope.location.origin), options);
    handlers.fetch({ request, respondWith(value) { response = value; } });
    return response;
  }
  async function status(repair = false) {
    const messages = [];
    await event('message', { data: { cmd: 'getOfflineStatus', repair }, ports: [{ postMessage(value) { messages.push(value); } }] });
    return messages;
  }
  return { handlers, stores, deleted, batches, event, fetch, status, setFailFetch(value) { failFetch = value; } };
}

test('failed precaching removes the partial new cache and keeps old and foreign caches', async () => {
  const h = harness();
  h.setFailFetch(true);
  h.stores.set('veli-offline-old', new Map());
  h.stores.set('veli-offline-new', new Map([['/index.html', new Response('partial')]]));
  h.stores.set('another-app', new Map());
  await assert.rejects(h.event('install'), /Network lost/);
  assert.deepEqual([...h.stores.keys()], ['veli-offline-old', 'another-app']);
});

test('activation cleans only previous Veli caches, and readiness checks actual cached entries', async () => {
  const h = harness();
  h.stores.set('veli-offline-old', new Map());
  h.stores.set('another-app', new Map());
  // Populate cache explicitly; install URL resolution is covered by browser tests.
  h.stores.set('veli-offline-new', new Map([
    ['/index.html', new Response('home')], ['/headless/index.html', new Response('headless')], ['/offline.html', new Response('notice')],
  ]));
  await h.event('activate');
  assert.deepEqual(h.deleted, ['veli-offline-old']);
  assert.deepEqual(await h.status(), [{ ready: true }]);
  h.stores.get('veli-offline-new').delete('/headless/index.html');
  assert.deepEqual(await h.status(), [{ ready: false }]);
  assert.equal(h.batches.length, 0);
  assert.equal(h.fetch('/file?id=secret'), undefined);
  assert.equal(h.fetch('/unknown'), undefined);
  assert.equal(h.fetch('https://external.test/index.html'), undefined);
  assert.equal(h.fetch('/index.html', { method: 'POST', body: 'secret' }), undefined);
});

test('a failed repair preserves cached entries and a later status check restores only missing build resources', async () => {
  const h = harness();
  const home = new Response('home');
  const cache = new Map([['/index.html', home], ['/offline.html', new Response('notice')]]);
  h.stores.set('veli-offline-new', cache);
  h.setFailFetch(true);
  assert.deepEqual(await h.status(true), [{ repairing: true }, { ready: false }]);
  assert.equal(cache.get('/index.html'), home);
  assert.equal(cache.has('/headless/index.html'), false);
  assert.deepEqual(h.deleted, []);

  h.setFailFetch(false);
  const results = await Promise.all([h.status(true), h.status(true)]);
  for (const messages of results) {
    assert.deepEqual(messages, [{ repairing: true }, { ready: true }]);
  }
  assert.equal(cache.get('/index.html'), home);
  assert.deepEqual(await h.status(), [{ ready: true }]);
  assert.deepEqual(h.batches.map(batch => batch.map(request => [request.url, request.cache, request.integrity])), [
    [['https://veli.test/headless/index.html', 'reload', precache['/headless/index.html']]],
    [['https://veli.test/headless/index.html', 'reload', precache['/headless/index.html']]],
  ]);
});

test('development builds install no offline event handlers', () => {
  let count = 0;
  installOffline({ addEventListener() { count++; } }, {}, 'development');
  assert.equal(count, 0);
});

test('cached redirected HTML is returned without redirect history or lost headers/body', async () => {
  const h = harness();
  const cached = new Response('redirected HTML', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Test': 'preserved' } });
  Object.defineProperty(cached, 'redirected', { value: true });
  h.stores.set('veli-offline-new', new Map([['/index.html', cached]]));
  let pending;
  h.handlers.fetch({
    request: { url: 'https://veli.test/?tab=decryption', method: 'GET', mode: 'navigate' },
    respondWith(value) { pending = value; },
  });
  const response = await pending;
  assert.equal(response.redirected, false);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('X-Test'), 'preserved');
  assert.equal(response.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(await response.text(), 'redirected HTML');
});
