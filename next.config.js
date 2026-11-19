const { createRequire } = require("node:module");

module.exports = {
  reactStrictMode: false,
  trailingSlash: true,
  output: 'export',
  webpack(config, { isServer, webpack }) {
    const sodiumWrapper = require.resolve("libsodium-wrappers-sumo");
    config.resolve.alias = {
      ...config.resolve.alias,
      "libsodium-wrappers-sumo": sodiumWrapper,
      "libsodium-sumo": createRequire(sodiumWrapper).resolve("libsodium-sumo"),
    };
    if (!isServer) {
      // Sodium 0.8 uses node: imports in its Node-only initialization path.
      // Normalize them so the browser build can apply the empty fallbacks.
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(
        /^node:(fs|path|crypto|stream)$/,
        resource => { resource.request = resource.request.slice(5); }
      ));
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, path: false, crypto: false, stream: false,
      };
    }
    return config;
  },
}
