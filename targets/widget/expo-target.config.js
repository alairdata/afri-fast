/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'LoggaWidgets',
  displayName: 'Logga',
  bundleIdentifier: '.widget',
  // Widgets use the tappable water button (App Intents), which needs iOS 17.
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'AppIntents'],
  // Same App Group as the app, so the app can hand today's numbers to the widgets.
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
  images: {
    LoggaWordmark: './LoggaWordmark.png',
  },
});
