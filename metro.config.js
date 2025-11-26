const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Expo SDK 53 specific resolver configuration for Node.js modules
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Lista reduzida de módulos Node.js desabilitados
  if (
    moduleName === 'fs' ||
    moduleName === 'path' ||
    moduleName === 'os' ||
    moduleName.startsWith('node:')
  ) {
    return {
      type: 'empty',
    };
  }

  // Default resolver
  return context.resolveRequest(context, moduleName, platform);
};

// Add support for resolving modules including .mjs files
config.resolver.sourceExts = ['mjs', 'jsx', 'js', 'ts', 'tsx', 'json'];
config.resolver.assetExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ttf', 'otf'];

// Add resolution for nanoid and other problematic modules
config.resolver.extraNodeModules = {
  'nanoid/non-secure': require.resolve('nanoid/non-secure'),
};

// Desabilitar a resolução de package exports que causa conflitos
config.resolver.unstable_enablePackageExports = false;

// Configurações específicas para web
if (process.env.EXPO_PLATFORM === 'web') {
  config.resolver.alias = {
    ...config.resolver.alias,
    'react-native$': 'react-native-web',
    'react-native/Libraries/EventEmitter/NativeEventEmitter$': 'react-native-web/dist/vendor/react-native/NativeEventEmitter',
  };
}

module.exports = withNativeWind(config, { input: "./global.css" });