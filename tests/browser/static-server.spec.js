const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');
const path = require('node:path');
const { staticServer } = require('../helpers/staticServer');

for (const route of ['about', 'headless', 'generate-keys']) {
  test(`static server redirects /${route} to its exported directory page`, async ({ request }) => {
    const server = await staticServer({ redirectHtml: true });
    try {
      const url = `${server.baseURL}/${route}?tab=decryption&language=ko_KR`;
      const redirect = await request.get(url, { maxRedirects: 0 });
      expect(redirect.status()).toBe(308);
      expect(redirect.headers().location).toBe(`/${route}/?tab=decryption&language=ko_KR`);
      const page = await request.get(url);
      expect(page.status()).toBe(200);
      expect(page.headers()['content-type']).toBe('text/html');
      expect(await page.body()).toEqual(await fs.readFile(path.join('out', route, 'index.html')));
    } finally { await server.close(); }
  });
}

test('static server preserves HTML normalization and the standalone offline page', async ({ request }) => {
  const server = await staticServer({ redirectHtml: true });
  try {
    for (const [source, destination, file] of [
      ['/index.html', '/', 'index.html'],
      ['/headless/index.html', '/headless/', 'headless/index.html'],
      ['/offline.html', '/offline', 'offline.html'],
    ]) {
      const redirect = await request.get(server.baseURL + source + '?check=1', { maxRedirects: 0 });
      expect(redirect.status()).toBe(308);
      expect(redirect.headers().location).toBe(destination + '?check=1');
      const page = await request.get(server.baseURL + source);
      expect(page.status()).toBe(200);
      expect(await page.body()).toEqual(await fs.readFile(path.join('out', file)));
    }
    expect((await request.get(server.baseURL + '/missing')).status()).toBe(404);
  } finally { await server.close(); }
});
