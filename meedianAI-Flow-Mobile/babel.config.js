module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // SDK 50+ includes expo-router via babel-preset-expo; no extra plugin needed
    plugins: [],
  };
};
