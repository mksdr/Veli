const esbuild = require("esbuild");
const path = require("path");

// Stub Node.js built-in modules required by libsodium / libsodium-wrappers in browser/SW environments
const emptyNodeModulesPlugin = {
  name: "empty-node-modules",
  setup(build) {
    const filter = /^(?:node:)?(fs|path|crypto)$/;
    build.onResolve({ filter }, (args) => ({
      path: args.path,
      namespace: "empty-node-module",
    }));
    build.onLoad({ filter: /.*/, namespace: "empty-node-module" }, () => ({
      contents: "module.exports = {};",
      loader: "js",
    }));
  },
};

async function buildServiceWorker(options = {}) {
  const isMinify =
    options.minify ??
    (process.argv.includes("--minify") || process.env.MINIFY === "true");
  const isSourcemap =
    options.sourcemap ??
    (process.argv.includes("--sourcemap") || process.env.SOURCEMAP === "true");

  const projectRoot = path.resolve(__dirname, "..");

  const result = await esbuild.build({
    entryPoints: [path.join(projectRoot, "service-worker/sw.js")],
    outfile: path.join(projectRoot, "public/service-worker.js"),
    bundle: true,
    platform: "browser",
    format: "iife",
    target: ["es2020"],
    define: {
      global: "self",
    },
    plugins: [emptyNodeModulesPlugin],
    minify: isMinify,
    sourcemap: isSourcemap,
  });

  return result;
}

if (require.main === module) {
  buildServiceWorker()
    .then(() => {
      console.log("Service Worker bundle built successfully with esbuild.");
    })
    .catch((err) => {
      console.error("Failed to build Service Worker bundle:", err);
      process.exit(1);
    });
}

module.exports = { buildServiceWorker, emptyNodeModulesPlugin };
