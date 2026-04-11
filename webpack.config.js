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
    'abort-controller': path.resolve(
      __dirname,
      'node_modules/abort-controller/dist/abort-controller.js'
    ),
    'abort-controller/polyfill': path.resolve(
      __dirname,
      'node_modules/abort-controller/polyfill.js'
    ),
    'expo-notifications': path.resolve(__dirname, 'src/lib/notifications-stub.js'),
  };
  // Drop all console calls in production builds
  if (env.mode === 'production') {
    config.optimization = config.optimization || {};
    config.optimization.minimizer = config.optimization.minimizer || [];
    const TerserPlugin = require('terser-webpack-plugin');
    config.optimization.minimizer.push(
      new TerserPlugin({
        terserOptions: { compress: { drop_console: true } },
      })
    );
  }

  return config;
};
