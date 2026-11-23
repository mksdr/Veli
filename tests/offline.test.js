const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installOffline } = require('../service-worker/offline.ts');

function harness(version = 'new', failInstall = false) {
  const handlers = {};
  const stores = new Map();
  const deleted = [];
  const scope = { location: { origin: 'https://veli.test' }, addEventListener(type, handler) { handlers[type] = handler; } };
  global.caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const data = stores.get(name);
      return {
        async addAll(requests) {
          for (const request of requests) {
            data.set(new URL(request.url).pathname, new Response('cached'));
            if (failInstall) throw new Error('Network lost');
          }
        },
        async keys() { return [...data.keys()].map(url => new Request('https://veli.test' + url)); },
        async match(key) { return data.get(key)?.clone(); },
      };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { deleted.push(name); return stores.delete(name); },
  };
  installOffline(scope, ['/index.html', '/headless/index.html', '/offline.html'], version);
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
  return { handlers, stores, deleted, event, fetch, scope };
}

test('failed precaching removes the partial new cache and keeps old and foreign caches', async () => {
  const h = harness('new', true);
  h.stores.set('veli-offline-old', new Map());
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
  const messages = [];
  const message = () => h.event('message', { data: { cmd: 'getOfflineStatus' }, ports: [{ postMessage(value) { messages.push(value); } }] });
  await message();
  h.stores.get('veli-offline-new').delete('/headless/index.html');
  await message();
  assert.deepEqual(messages, [{ ready: true }, { ready: false }]);
  assert.equal(h.fetch('/file?id=secret'), undefined);
  assert.equal(h.fetch('/unknown'), undefined);
  assert.equal(h.fetch('https://external.test/index.html'), undefined);
  assert.equal(h.fetch('/index.html', { method: 'POST', body: 'secret' }), undefined);
});

test('development builds install no offline event handlers', () => {
  let count = 0;
  installOffline({ addEventListener() { count++; } }, [], 'development');
  assert.equal(count, 0);
});
