const { test: base, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const sodium = require('libsodium-wrappers-sumo');
const { staticServer } = require('../helpers/staticServer');
const { contents, encrypt, decrypt, plaintext } = require('../helpers/browserFiles');

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
async function downloadDecrypted(page, panel) {
  const download = page.waitForEvent('download');
  const stream = panel.getByRole('button', { name: 'Decrypt & download', exact: true });
  if (await stream.isVisible()) await stream.click();
  else await panel.getByRole('button', { name: 'Download decrypted file', exact: true }).click();
  expect(await contents(await download)).toEqual(plaintext);
}

test('prepares unvisited pages, reloads offline, and keeps About online only', async ({ page, context, offlineServer, browserName }) => {
  await prepare(page);
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
