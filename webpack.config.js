const createExpoWebpackConfigAsync = require('@expo/webpack-config');
const path = require('path');

module.exports = async function (env, argv) {
  const config = await createExpoWebpackConfigAsync({ ...env, pwa: false }, argv);
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    '@react-native-async-storage/async-storage': path.resolve(
      __dirname,
      'node_modules/@react-native-async-storage/async-storage/lib/commonjs/index.js'
    ),
  };
  return config;
};
