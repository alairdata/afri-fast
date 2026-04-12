const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Stub expo-notifications on web (not supported)
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
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
