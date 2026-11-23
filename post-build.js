const { copyFile } = require("node:fs/promises");
const { join } = require("node:path");
const { buildOfflineWorker } = require("./scripts/build-offline");

async function main() {
  await copyFile(join(__dirname, "out/404/index.html"), join(__dirname, "out/404.html"));
  await buildOfflineWorker(join(__dirname, "out"));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
