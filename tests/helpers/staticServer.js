const { createServer } = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

async function staticServer() {
  const root = path.resolve('out');
  let connected = true;
  let worker;
  const server = createServer(async (request, response) => {
    if (!connected) { request.socket.destroy(); return; }
    try {
      const url = new URL(request.url, 'http://localhost');
      const file = path.resolve(root, '.' + url.pathname + (url.pathname.endsWith('/') ? 'index.html' : ''));
      if (!file.startsWith(root + path.sep)) throw new Error('Invalid path');
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png' };
      response.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
      response.setHeader('Cache-Control', 'no-store');
      response.end(url.pathname === '/service-worker.js' && worker ? worker : await fs.readFile(file));
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    baseURL: `http://127.0.0.1:${server.address().port}`,
    setConnected(value) { connected = value; },
    setWorker(value) { worker = value; },
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
module.exports = { staticServer };
