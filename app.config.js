/**
 * Single source of truth for Expo configuration (SDK 54).
 * Replaces app.json - do not add a static app.json alongside this file.
 */
/** @type {import("expo/config").ExpoConfig} */
module.exports = {
  name: "DarziApp",
  slug: "DarziApp",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "darziapp",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.darziapp.mobile",
    buildNumber: "1",
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        "Allow BookMyDarzi to access your photos to update your profile picture.",
      NSCameraUsageDescription:
        "Allow BookMyDarzi to use your camera to capture order progress photos.",
    },
  },
  android: {
    package: "com.darziapp.mobile",
    versionCode: 1,
    // Must be nested under config.googleMaps.apiKey - Expo's prebuild plugin
    // only injects the com.google.android.geo.API_KEY manifest meta-data
    // from this exact path. A top-level android.googleMapsApiKey is silently
    // ignored, so the native Google Maps SDK has no key in a release build
    // and crashes on MapView inflate (works in Expo Go/dev-client only
    // because those don't go through this same native manifest step).
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY ?? "",
      },
    },
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.CAMERA",
    ],
  },
  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
  },
  plugins: [
    [
      "expo-dev-client",
      {
        launchMode: "most-recent",
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 24,
          compileSdkVersion: 35,
          targetSdkVersion: 35,
        },
        ios: {
          deploymentTarget: "15.1",
        },
      },
    ],
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#000000",
        },
      },
    ],
    "expo-secure-store",
    [
      "expo-notifications",
      {
        icon: "./assets/images/icon.png",
        color: "#1a73e8",
        sounds: [],
        androidMode: "default",
        androidCollapsedTitle: "BookMyDarzi",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission:
          "Allow BookMyDarzi to access your photos to update your profile picture.",
        cameraPermission:
          "Allow BookMyDarzi to use your camera to capture order progress photos.",
        microphonePermission: false,
      },
    ],
    "./plugins/withCleartextTraffic.js",
    "./plugins/withRazorpayGradle.js",
    "@sentry/react-native",
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "https://web-production-efff7.up.railway.app",
    eas: {
      projectId: "55f606c1-bb85-411c-ad29-dc68cee99844",
    },
  },
};
