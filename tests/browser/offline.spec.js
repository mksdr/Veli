const { test: base, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sodium = require('libsodium-wrappers-sumo');
const { staticServer } = require('../helpers/staticServer');
const { contents, encrypt, decrypt, password, plaintext } = require('../helpers/browserFiles');

// Firefox automation's ephemeral profiles bypass worker control on navigation.
const test = base.extend({
  offlineServer: async ({}, provide) => {
    const server = await staticServer({ redirectHtml: true });
    try { await provide(server); }
    finally { await server.close(); }
  },
  context: async ({ browserName, playwright, contextOptions, offlineServer }, provide, testInfo) => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'veli-offline-'));
    const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
    const context = await playwright[browserName].launchPersistentContext(directory, {
      ...contextOptions, viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, headless: true, baseURL: offlineServer.baseURL, acceptDownloads: true,
    });
    try { await provide(context); }
    finally { await context.close(); await fs.rm(directory, { recursive: true, force: true }); }
  },
});

async function disconnect(context, server) {
  // Firefox's emulated offline mode does not block worker-originated fetches.
  // Sever the real endpoint too, so every browser exercises network failure.
  server.setConnected(false);
  await context.setOffline(true);
}

async function prepare(page) {
  await page.goto('/');
  await expect(page.getByTestId('offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
}

async function openWithWorkerState(page, { slot, state, controlled = false, hasWaitingUpdate = false }) {
  await page.addInitScript(({ slot, state, controlled, hasWaitingUpdate }) => {
    const requests = [];
    const protocolRequests = [];
    const createWorker = state => Object.assign(new EventTarget(), {
      state,
      postMessage(data, [port]) {
        if (data.cmd === 'getOfflineStatus') requests.push(port);
        if (data.cmd === 'getProtocolVersion') protocolRequests.push(port);
      },
    });
    const worker = createWorker(state);
    const registration = Object.assign(new EventTarget(), { installing: null, waiting: null, active: null });
    registration[slot] = worker;
    if (hasWaitingUpdate) registration.waiting = createWorker('installed');
    const container = navigator.serviceWorker;
    const fixture = window.workerFixture = { requests, protocolRequests, createWorker, worker, registration, controller: controlled ? worker : null };
    Object.defineProperties(container, {
      controller: { get: () => fixture.controller },
      register: { value: async () => { fixture.registered = true; return registration; } },
    });
  }, { slot, state, controlled, hasWaitingUpdate });
  await page.goto('/');
  await page.waitForFunction(() => window.workerFixture.registered);
  return page.getByTestId('offline-status');
}

test('first installation stays preparing until the activating worker claims the page', async ({ page }) => {
  const status = await openWithWorkerState(page, { slot: 'installing', state: 'installing' });
  await page.evaluate(() => {
    const { registration, worker } = window.workerFixture;
    registration.installing = null;
    registration.waiting = worker;
    worker.state = 'installed';
    worker.dispatchEvent(new Event('statechange'));
    registration.waiting = null;
    registration.active = worker;
    worker.state = 'activating';
    worker.dispatchEvent(new Event('statechange'));
    // Let the UI render before the worker claims the page.
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await expect(status).toHaveAttribute('data-state', 'preparing');
  await page.evaluate(() => {
    const fixture = window.workerFixture;
    fixture.controller = fixture.worker;
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
    fixture.requests[0].postMessage({ ready: true });
  });
  await expect(status).toHaveAttribute('data-state', 'ready');
});

test('a first worker already waiting at registration can become redundant', async ({ page }) => {
  const status = await openWithWorkerState(page, { slot: 'waiting', state: 'installed' });
  await expect(status).toHaveAttribute('data-state', 'preparing');
  await page.evaluate(() => {
    const { registration, worker } = window.workerFixture;
    worker.state = 'redundant';
    worker.dispatchEvent(new Event('statechange'));
    // A registration slot can be cleared after statechange is dispatched.
    registration.waiting = null;
  });
  await expect(status).toHaveAttribute('data-state', 'unavailable');
});

test('activation completing without a controller becomes unavailable', async ({ page }) => {
  const status = await openWithWorkerState(page, { slot: 'active', state: 'activating' });
  await expect(status).toHaveAttribute('data-state', 'preparing');
  await page.evaluate(() => {
    const { worker } = window.workerFixture;
    worker.state = 'activated';
    worker.dispatchEvent(new Event('statechange'));
  });
  await expect(status).toHaveAttribute('data-state', 'unavailable');
});

test('a page bypassing an activated worker is unavailable even with a waiting update', async ({ page }) => {
  const status = await openWithWorkerState(page, { slot: 'active', state: 'activated', hasWaitingUpdate: true });
  await expect(status).toHaveAttribute('data-state', 'unavailable');
});

test('a background update does not interrupt an offline cache repair', async ({ page }) => {
  const status = await openWithWorkerState(page, { slot: 'active', state: 'activated', controlled: true });
  await expect.poll(() => page.evaluate(() => window.workerFixture.requests.length)).toBe(1);
  await page.evaluate(() => window.workerFixture.requests[0].postMessage({ ready: true }));
  await expect(status).toHaveAttribute('data-state', 'ready');
  await page.evaluate(() => {
    const fixture = window.workerFixture;
    const nextController = fixture.createWorker('activated');
    fixture.registration.active = nextController;
    fixture.controller = nextController;
    navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
    fixture.requests[1].postMessage({ repairing: true });
  });
  await expect(status).toHaveAttribute('data-state', 'preparing');
  await page.evaluate(() => {
    const { registration, createWorker, requests } = window.workerFixture;
    const update = createWorker('installing');
    registration.installing = update;
    registration.dispatchEvent(new Event('updatefound'));
    registration.installing = null;
    registration.waiting = update;
    update.state = 'installed';
    update.dispatchEvent(new Event('statechange'));
    requests[1].postMessage({ ready: true });
  });
  expect(await page.evaluate(() => window.workerFixture.requests.length)).toBe(2);
  await expect(status).toHaveAttribute('data-state', 'ready');
});

for (const controlled of [false, true]) {
  test(`a delayed worker protocol reply enables streaming ${controlled ? 'on a controlled navigation' : 'after a first claim'}`, async ({ page, browserName }) => {
    test.skip(browserName === 'webkit', 'Exercise the desktop streaming eligibility path');
    await page.clock.install();
    await openWithWorkerState(page, { slot: 'active', state: 'activated', controlled });
    const fileInput = page.locator('#enc-file');
    if (!controlled) {
      await expect(fileInput).toBeAttached();
      await page.evaluate(() => {
        const fixture = window.workerFixture;
        fixture.controller = fixture.worker;
        navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
      });
    }
    await page.waitForFunction(() => window.workerFixture.protocolRequests.length === 1);
    await page.clock.fastForward(2100);
    await expect(fileInput).toBeAttached();
    await expect(fileInput).not.toHaveAttribute('multiple', '');

    await page.evaluate(() => window.workerFixture.protocolRequests[0].postMessage({ version: 1 }));
    await expect(fileInput).toHaveAttribute('multiple', '');
  });
}

async function downloadDecrypted(page, panel) {
  const download = page.waitForEvent('download');
  const stream = panel.getByRole('button', { name: 'Decrypt & download', exact: true });
  if (await stream.isVisible()) await stream.click();
  else await panel.getByRole('button', { name: 'Download decrypted file', exact: true }).click();
  expect(await contents(await download)).toEqual(plaintext);
}

test('first install rejects an HTML response from a different build', async ({ page, offlineServer }) => {
  const otherBuildHtml = '<!doctype html><title>Veli from another build</title>';
  offlineServer.setFile('/generate-keys/', otherBuildHtml);
  const response = await page.request.get('/generate-keys/index.html');
  expect(response.status()).toBe(200);
  expect(await response.text()).toBe(otherBuildHtml);

  await page.goto('/');
  const status = page.getByTestId('offline-status');
  await expect(status).toHaveAttribute('data-state', /^(ready|unavailable)$/, { timeout: 30000 });
  expect(await status.getAttribute('data-state')).toBe('unavailable');
  expect(await page.evaluate(async () => ({
    controlled: Boolean(navigator.serviceWorker.controller),
    offlineCaches: (await caches.keys()).filter(name => name.startsWith('veli-offline-')),
  }))).toEqual({ controlled: false, offlineCaches: [] });
});

test('a slow first precache leaves home usable and enables streaming after the initial timeout', async ({ page, browserName, offlineServer }) => {
  test.skip(browserName === 'webkit', 'Exercise the desktop streaming eligibility path');
  const html = await fs.readFile(path.join('out', 'generate-keys', 'index.html'));
  const { promise, resolve } = Promise.withResolvers();
  offlineServer.setFile('/generate-keys/', promise);
  try {
    await page.clock.install();
    await page.goto('/?tab=encryption&publicKey=' + encodeURIComponent('+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/v7+/s='));
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.installing?.state === 'installing');
    await expect(page.getByRole('button', { name: 'Browse File', exact: true })).toBeEnabled({ timeout: 2000 });
    await expect(page.getByText("Recipient's public key is loaded, please select a file to encrypt.")).toBeVisible();
    await page.clock.fastForward(5100);
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
    // Firefox reports cancel immediately when Playwright intercepts the picker.
    if (browserName === 'chromium') {
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Browse File', exact: true }).click();
      await chooser;
    }
  } finally {
    resolve(html);
  }
  await expect(page.getByTestId('offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 15000 });
  if (browserName === 'chromium') {
    await expect(page.getByRole('button', { name: 'Browse File', exact: true })).toBeEnabled();
    await page.locator('#enc-file').dispatchEvent('cancel');
  }
  await expect(page.locator('#enc-file')).toHaveAttribute('multiple', '', { timeout: 15000 });
  await expect(page.getByText("Recipient's public key is loaded, please select a file to encrypt.")).toBeVisible();
});

test('a late claim preserves a headless buffered draft and enables streaming after reset', async ({ page, browserName, offlineServer }) => {
  test.skip(browserName === 'webkit', 'Exercise the desktop streaming eligibility path');
  const html = await fs.readFile(path.join('out', 'generate-keys', 'index.html'));
  const { promise, resolve } = Promise.withResolvers();
  offlineServer.setFile('/generate-keys/', promise);
  const file = { name: 'buffered-draft.txt', mimeType: 'text/plain', buffer: plaintext };
  try {
    await page.goto('/headless/');
    await expect(page.getByRole('button', { name: 'Browse File', exact: true })).toBeEnabled({ timeout: 2000 });
    await page.locator('#enc-file').setInputFiles(file);
    await page.getByRole('button', { name: 'Set a password', exact: true }).click();
    await page.getByLabel(/^Password\s*\*?$/).fill(password);
  } finally {
    resolve(html);
  }
  await expect(page.getByTestId('offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 15000 });
  await expect(page.getByText(file.name, { exact: true }).filter({ visible: true })).toBeVisible();
  await expect(page.getByLabel(/^Password\s*\*?$/)).toHaveValue(password);
  await page.getByRole('button', { name: 'Review encryption', exact: true }).click();
  await page.getByRole('button', { name: 'Encrypt file', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download encrypted file', exact: true }).click();
  expect((await contents(await download)).byteLength).toBeGreaterThan(plaintext.byteLength);
  await page.getByRole('button', { name: 'Choose another file', exact: true }).click();
  await expect(page.locator('#enc-file')).toHaveAttribute('multiple', '');
});

test('reopening online restores an evicted page without reinstalling the worker', async ({ page, context, offlineServer }) => {
  await prepare(page);
  await page.evaluate(async () => {
    window.initialWorker = navigator.serviceWorker.controller;
    const name = (await caches.keys()).find(key => key.startsWith('veli-offline-'));
    const cache = await caches.open(name);
    if (!await cache.delete('/generate-keys/index.html')) throw new Error('Expected a cached key generation page');
  });

  const reopened = await context.newPage();
  await prepare(reopened);
  expect(await page.evaluate(() => navigator.serviceWorker.controller === window.initialWorker)).toBe(true);

  await disconnect(context, offlineServer);
  await reopened.goto('/generate-keys/');
  await reopened.locator('.keyPairGenerateBtn').click();
  await expect(reopened.locator('#generatedPublicKey')).not.toHaveValue('');
});

test('the iPhone and iPad Home Screen app prepares on its first online launch', async ({ page, context, offlineServer }, testInfo) => {
  test.skip(!['iphone-webkit', 'ipad-webkit'].includes(testInfo.project.name), 'Exercise the Apple mobile Home Screen flow');
  // Playwright emulates the launch mode in a fresh profile with its own storage.
  await context.addInitScript(desktopMode => {
    Object.defineProperty(navigator, 'standalone', { value: true });
    if (desktopMode) {
      Object.defineProperties(navigator, {
        userAgent: { value: navigator.userAgent.replace(/\(iPad[^)]*\)/, '(Macintosh; Intel Mac OS X 10_15_7)') },
        platform: { value: 'MacIntel' },
        maxTouchPoints: { value: 5 },
      });
    }
  }, testInfo.project.name === 'ipad-webkit');
  await page.addInitScript(() => {
    const register = ServiceWorkerContainer.prototype.register;
    const allowRegistration = new Promise(resolve => { window.allowRegistration = resolve; });
    ServiceWorkerContainer.prototype.register = async function (...args) {
      await allowRegistration;
      return register.apply(this, args);
    };
  });
  await page.goto('/');
  const preparation = page.getByText('Keep Veli open and connected until it’s ready for offline use.', { exact: true });
  await expect(preparation).toBeVisible();
  const status = page.getByTestId('offline-status');
  await expect(status).toHaveAttribute('data-state', 'preparing');
  await expect(page.getByText('If you add Veli to your Home Screen,', { exact: false })).toHaveCount(0);
  await page.evaluate(() => window.allowRegistration());
  await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await expect(preparation).toHaveCount(0);

  await disconnect(context, offlineServer);
  const reopened = await context.newPage();
  await prepare(reopened);
  await expect(reopened.locator('#enc-file')).toBeAttached();
});

test('prepares unvisited pages, reloads offline, and keeps About online only', async ({ page, context, offlineServer, browserName }, testInfo) => {
  await prepare(page);
  const homeScreenSetup = page.getByText('If you add Veli to your Home Screen,', { exact: false });
  if (['iphone-webkit', 'ipad-webkit'].includes(testInfo.project.name)) await expect(homeScreenSetup).toBeVisible();
  else await expect(homeScreenSetup).toHaveCount(0);
  const cachePaths = await page.evaluate(async () => {
    const paths = [];
    for (const name of await caches.keys()) {
      if (name.startsWith('veli-offline-')) {
        for (const request of await (await caches.open(name)).keys()) paths.push(new URL(request.url).pathname);
      }
    }
    return paths;
  });
  // Model Pages hosting: these cache entries came from followed HTML redirects.
  expect(await page.evaluate(async () => {
    const name = (await caches.keys()).find(key => key.startsWith('veli-offline-'));
    return (await (await caches.open(name)).match('/index.html')).redirected;
  })).toBe(true);
  expect(cachePaths).toEqual(expect.arrayContaining(['/index.html', '/headless/index.html', '/generate-keys/index.html']));
  expect(cachePaths.some(url => /about|\/file(?:\?|$)/.test(url))).toBe(false);
  expect(cachePaths.some(url => url.startsWith('/assets/styles/'))).toBe(false);
  expect(cachePaths.some(url => url.startsWith('/_next/static/css/'))).toBe(true);
  expect(cachePaths.some(url => url.startsWith('/_next/static/media/') && url.endsWith('.woff2'))).toBe(true);

  // Compare the exported pages to detect About-only chunks even when their names are hashed.
  const [aboutScripts, ...offlineScripts] = await Promise.all([
    'about/index.html', 'index.html', 'headless/index.html', 'generate-keys/index.html',
  ].map(async file => {
    const html = await fs.readFile(path.join('out', file), 'utf8');
    return Array.from(html.matchAll(/<script\b[^>]*\bsrc="(\/_next\/static\/chunks\/[^"]+)"/g), match => match[1]);
  }));
  const sharedScripts = new Set(offlineScripts.flat());
  const aboutOnly = aboutScripts.filter(url => !sharedScripts.has(url));
  expect(aboutOnly.length).toBeGreaterThan(0);
  expect(cachePaths.filter(url => aboutOnly.includes(url))).toEqual([]);
  await disconnect(context, offlineServer);
  const icons = await page.evaluate(async () => {
    const manifest = await fetch(document.querySelector('link[rel="manifest"]').href).then(response => response.json());
    return Promise.all(manifest.icons.map(async icon => {
      const bitmap = await createImageBitmap(await fetch(icon.src).then(response => response.blob()));
      return `${bitmap.width}x${bitmap.height}`;
    }));
  });
  expect(icons).toEqual(['192x192', '512x512', '512x512']);
  await page.reload();
  await expect(page.getByTestId('offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  await expect(page.getByRole('link', { name: 'Help', exact: true })).toHaveAttribute('aria-disabled', 'true');
  for (const route of ['/headless/?tab=decryption', '/generate-keys/']) {
    await page.goto(route);
    await expect(page.getByTestId('offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
  }
  await page.locator('.keyPairGenerateBtn').click();
  await expect(page.locator('#generatedPublicKey')).not.toHaveValue('');
  const reopened = await context.newPage();
  await reopened.goto('/?tab=decryption');
  await expect(reopened.locator('#dec-file')).toBeAttached();
  await reopened.close();
  await page.bringToFront();
  for (const route of ['/about/', '/about']) {
    await page.goto(route);
    await expect(page.getByText('Help requires an internet connection.', { exact: false })).toBeVisible();
    await page.getByRole('link', { name: 'Home / 홈으로' }).click();
    await expect(page.locator('#enc-file')).toBeAttached();
  }
  offlineServer.setConnected(true);
  await context.setOffline(false);
  if (browserName === 'firefox') {
    // Firefox automation restores navigator.onLine after a worker-served
    // navigation but omits the online event. Exercise that platform event.
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
  }
  await expect(page.getByRole('link', { name: 'Help', exact: true })).not.toHaveAttribute('aria-disabled', 'true', { timeout: 15000 });
  await page.getByRole('link', { name: 'Help', exact: true }).click();
  await expect(page.getByText('Help requires an internet connection.', { exact: false })).toHaveCount(0);
});

for (const route of ['/', '/headless/']) {
  for (const mode of ['password', 'public-key']) {
    test(`offline ${mode} file round trip at ${route}`, async ({ page, context, offlineServer }) => {
      await prepare(page);
      await disconnect(context, offlineServer);
      await sodium.ready;
      const sender = sodium.crypto_kx_keypair(), receiver = sodium.crypto_kx_keypair();
      const encKeys = mode === 'public-key' ? {
        publicKey: sodium.to_base64(receiver.publicKey), privateKey: sodium.to_base64(sender.privateKey),
      } : undefined;
      const decKeys = mode === 'public-key' ? {
        publicKey: sodium.to_base64(sender.publicKey), privateKey: sodium.to_base64(receiver.privateKey),
      } : undefined;
      const encrypted = await encrypt(page, route, encKeys);
      await expect(page.getByRole('heading', { name: 'Your files are encrypted', exact: true })).toBeVisible();
      const panel = await decrypt(page, encrypted, route, decKeys);
      await downloadDecrypted(page, panel);
    });
  }
}

test('offline password generation, Korean, and dark mode survive reload', async ({ page, context, offlineServer }) => {
  await prepare(page);
  await disconnect(context, offlineServer);
  await page.locator('#enc-file').setInputFiles({ name: 'sample.txt', mimeType: 'text/plain', buffer: plaintext });
  await page.getByRole('button', { name: 'Set a password', exact: true }).click();
  await page.getByRole('combobox', { name: 'Generate Password', exact: true }).click();
  await page.getByRole('option', { name: 'Memorable words', exact: true }).click();
  await expect(page.getByRole('listbox', { includeHidden: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Create a password', exact: true }).click();
  expect((await page.locator('#encrypt-password').inputValue()).split('-')).toHaveLength(5);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Dark Mode', exact: true }).check();
  await page.getByRole('combobox', { name: 'Language', exact: true }).click();
  await page.getByRole('option', { name: '한국어', exact: true }).click();
  await page.getByRole('button', { name: 'Change language', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
  await page.reload();
  await expect(page.getByTestId('offline-status')).toHaveText('오프라인에서 사용할 준비가 완료됐어요');
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(18, 24, 32)');
});
