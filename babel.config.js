module.exports = function (api) {
  api.cache(true);
  const plugins = [];

  // Strip console.* calls from release/production builds only - dev logging
  // stays untouched locally. EAS sets NODE_ENV=production for build profiles
  // that don't explicitly override it (development profile does via its own
  // env block), so this only fires for real release builds, not local dev.
  if (process.env.NODE_ENV === "production") {
    plugins.push(["transform-remove-console", { exclude: ["error", "warn"] }]);
  }

  plugins.push(
    // Must be listed last - required for react-native-reanimated
    "react-native-reanimated/plugin",
  );

  return {
    presets: ["babel-preset-expo"],
    plugins,
  };
};
