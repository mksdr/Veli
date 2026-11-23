const { test, expect } = require('@playwright/test');
const { staticServer } = require('../helpers/staticServer');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { contents, plaintext, password } = require('../helpers/browserFiles');
const { decryptLegacy } = require('../helpers/legacyCrypto');

test('an update waits for an active download and the installed app reopens offline', async ({ browserName, playwright }) => {
  test.skip(browserName !== 'chromium', 'Exercise the streaming worker lifecycle in Chromium');
  const root = path.resolve('out');
  const originalWorker = await fs.readFile(path.join(root, 'service-worker.js'), 'utf8');
  let worker = originalWorker;
  const server = await staticServer();
  const baseURL = server.baseURL;
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'veli-lifecycle-'));
  let context;
  try {
    context = await playwright.chromium.launchPersistentContext(directory, { headless: true, baseURL, acceptDownloads: true });
    await context.addInitScript(() => {
      const post = ServiceWorker.prototype.postMessage;
      ServiceWorker.prototype.postMessage = function (data, ...args) {
        if (data.cmd === 'requestEncryption') {
          window.resumeEncryption = () => post.call(this, data, ...args);
          return;
        }
        return post.call(this, data, ...args);
      };
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByTestId('offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    const oldName = await page.evaluate(async () => (await caches.keys()).find(name => name.startsWith('veli-offline-')));
    const version = oldName.slice('veli-offline-'.length);
    worker = originalWorker.replace(JSON.stringify(version), JSON.stringify(version + '-update'));
    expect(worker).not.toBe(originalWorker);
    server.setWorker(worker);
    await page.locator('#enc-file').setInputFiles({ name: 'updating.txt', mimeType: 'text/plain', buffer: plaintext });
    await page.getByRole('button', { name: 'Set a password', exact: true }).click();
    await page.locator('#encrypt-password').fill(password);
    await page.getByRole('button', { name: 'Review encryption', exact: true }).click();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Encrypt & download', exact: true }).click();
    await page.waitForFunction(() => !!window.resumeEncryption);
    await page.evaluate(async () => {
      window.initialWorker = navigator.serviceWorker.controller;
      await (await navigator.serviceWorker.getRegistration()).update();
    });
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration()).waiting?.state === 'installed');
    expect(await page.evaluate(() => navigator.serviceWorker.controller === window.initialWorker)).toBe(true);
    await page.evaluate(() => window.resumeEncryption());
    expect(await decryptLegacy(await contents(await download), password)).toEqual(plaintext);
    await expect(page.getByRole('heading', { name: 'Your files are encrypted', exact: true })).toBeVisible();
    await context.close(); context = null;
    // Reopen the same profile without a network connection or HTTP cache access.
    context = await playwright.chromium.launchPersistentContext(directory, { headless: true, baseURL, acceptDownloads: true });
    await context.setOffline(true);
    const reopened = await context.newPage();
    await reopened.goto('/generate-keys/');
    await expect(reopened.getByTestId('offline-status')).toHaveAttribute('data-state', 'ready', { timeout: 30000 });
    await expect.poll(() => reopened.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('veli-offline-')))).toEqual([oldName + '-update']);
    await reopened.locator('.keyPairGenerateBtn').click();
    await expect(reopened.locator('#generatedPublicKey')).not.toHaveValue('');
  } finally {
    await context?.close();
    await server.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
