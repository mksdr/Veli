const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

async function staticServer({ redirectHtml = false } = {}) {
  const root = path.resolve('out');
  let connected = true;
  const fileOverrides = new Map();
  const server = createServer(async (request, response) => {
    if (!connected) { request.socket.destroy(); return; }
    try {
      const url = new URL(request.url, 'http://localhost');
      if (redirectHtml && url.pathname.endsWith('.html')) {
        const destination = url.pathname.endsWith('/index.html')
          ? url.pathname.slice(0, -'index.html'.length) : url.pathname.slice(0, -'.html'.length);
        response.writeHead(308, { Location: destination + url.search }).end();
        return;
      }
      let pathname = url.pathname;
      if (redirectHtml && !path.extname(pathname) && !pathname.endsWith('/')) {
        const directory = path.resolve(root, '.' + pathname);
        if (!directory.startsWith(root + path.sep)) throw new Error('Invalid path');
        if ((await fs.stat(directory).catch(() => null))?.isDirectory()) {
          response.writeHead(308, { Location: pathname + '/' + url.search }).end();
          return;
        }
        // Standalone exports such as offline.html use extensionless URLs too.
        pathname += '.html';
      }
      const file = path.resolve(root, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
      if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png' };
      response.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
      response.setHeader('Cache-Control', 'no-store');
      response.end(fileOverrides.get(url.pathname) ?? await fs.readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    baseURL: `http://127.0.0.1:${server.address().port}`,
    setConnected(value) { connected = value; },
    setFile(urlPath, body) { fileOverrides.set(urlPath, body); },
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
module.exports = { staticServer };
