const { readFile, readdir } = require("node:fs/promises");
const { join } = require("node:path");
const { createHash } = require("node:crypto");
const { buildServiceWorker } = require("./build-sw");

async function filesUnder(root, prefix = "") {
  const files = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await filesUnder(root, name + "/"));
    else files.push(name);
  }
  return files.sort();
}

async function buildOfflineWorker(root) {
  const files = await filesUnder(root);
  // Use Next's route manifest to exclude about-only page bundles and data.
  const buildId = JSON.parse(await readFile(join(root, "index.html"), "utf8")
    .then(html => html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1])).buildId;
  const manifestText = await readFile(join(root, `_next/static/${buildId}/_buildManifest.js`), "utf8");
  const vm = require("node:vm");
  const sandbox = { self: {} };
  vm.runInNewContext(manifestText, sandbox, { timeout: 1000 });
  const manifest = sandbox.self.__BUILD_MANIFEST;
  const shared = new Set(Object.entries(manifest)
    .filter(([route, value]) => route !== "/about" && Array.isArray(value))
    .flatMap(([, value]) => value));
  const aboutOnly = new Set((manifest["/about"] ?? []).filter(file => !shared.has(file)));
  const precache = files.filter(file => {
    if (["index.html", "headless/index.html", "generate-keys/index.html", "offline.html", "manifest.webmanifest", "favicon.ico", "favicon.svg"].includes(file)) return true;
    if (file.startsWith("assets/")) return true;
    if (file.startsWith("_next/static/")) return !file.endsWith(".map") && !aboutOnly.has(file.slice("_next/".length));
    return file.startsWith("_next/data/") && /\/(index|headless|generate-keys)\.json$/.test(file);
  });
  const hash = createHash("sha256");
  const integrity = {};
  for (const file of precache) {
    const contents = await readFile(join(root, file));
    hash.update(file);
    hash.update(contents);
    integrity["/" + file] = "sha256-" + createHash("sha256").update(contents).digest("base64");
  }
  // Include worker sources so worker-only changes also produce a new cache.
  for (const file of await filesUnder(join(__dirname, "../service-worker"))) {
    hash.update(await readFile(join(__dirname, "../service-worker", file)));
  }
  await buildServiceWorker({ outfile: join(root, "service-worker.js"), precache: integrity, version: hash.digest("hex").slice(0, 20), minify: true });
}
module.exports = { buildOfflineWorker };
