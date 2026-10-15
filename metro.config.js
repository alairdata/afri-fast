const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Rive animation files (assets/rive/*.riv) ship as assets.
config.resolver.assetExts.push('riv');

// Stub expo-notifications on web (not supported)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Rive is native-only; on web the gauge falls back to the drawn one.
  if (platform === 'web' && moduleName === 'rive-react-native') {
    return { filePath: `${__dirname}/src/lib/rive-stub.js`, type: 'sourceFile' };
  }
  if (platform === 'web' && moduleName === 'expo-notifications') {
    return {
      filePath: `${__dirname}/src/lib/notifications-stub.js`,
      type: 'sourceFile',
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
