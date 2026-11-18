module.exports = {
  reactStrictMode: false,
  trailingSlash: true,
  output: 'export',
  webpack(config, { isServer, webpack }) {
    config.resolve.alias = {
      ...config.resolve.alias,
      "libsodium-wrappers-sumo": require.resolve("libsodium-wrappers-sumo"),
      "libsodium-sumo": require.resolve("libsodium-sumo"),
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
