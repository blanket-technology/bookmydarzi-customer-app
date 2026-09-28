/**
 * Single source of truth for Expo configuration (SDK 54).
 * Replaces app.json - do not add a static app.json alongside this file.
 */
// Only the local-dev-client build profiles ("development"/"development-railway"
// in eas.json) connect over a raw http:// URL (Metro, or a bare LAN IP like
// 192.168.x.x) - preview/staging/production all use HTTPS (Railway/ngrok).
// withCleartextTraffic.js was previously applied unconditionally, so every
// build including the production AAB submitted to Play shipped with
// android:usesCleartextTraffic="true" and a network-security-config trusting
// plain HTTP app-wide - an unjustified capability Play Store review flags,
// and a real (if narrow) weakening of the shipped app's network security for
// no reason, since production never actually uses cleartext HTTP.
const isLocalDevBuild = process.env.APP_VARIANT === "development";

/** @type {import("expo/config").ExpoConfig} */
module.exports = {
  // Display name shown as the app's title (home screen, Expo Go's list,
  // OS app switcher) - kept separate from `slug` (the Expo/EAS project
  // identifier) and `scheme` (the darziapp:// deep-link scheme used by
  // Razorpay/UPI return flows and app links), neither of which should
  // change without also updating the EAS project and every place that
  // scheme is hardcoded.
  name: "BookMyDarzi",
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
      NSLocationWhenInUseUsageDescription:
        "BookMyDarzi uses your location to find your address for pickup and delivery, and to show nearby service availability.",
      // Required for expo-audio's voice-note recording feature (checkout/
      // order screens) - without this, iOS refuses the mic permission
      // prompt outright and App Store review rejects the build for using
      // a restricted API (microphone) with no usage-description string.
      NSMicrophoneUsageDescription:
        "Allow BookMyDarzi to access your microphone to record a voice note for your tailor.",
    },
    // Lets Razorpay/UPI apps (GPay, PhonePe, Paytm) return to this app via a
    // verified https link instead of only the bare darziapp:// custom scheme,
    // which some UPI apps fail to redirect back through reliably. Requires
    // hosting /.well-known/apple-app-site-association on this domain (see
    // public/.well-known/apple-app-site-association in the web repo) with
    // the real Apple Team ID filled in - see that file's TODO.
    associatedDomains: ["applinks:bookmydarzi.com"],
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
      // Matches the custom splash screen's own backgroundColor (below) so
      // the native Android splash and the app's JS-driven splash hand off
      // without a visible color flash between them - previously this was
      // a leftover light-blue (#E6F4FE) from before the app icon assets
      // were replaced with real branding, which no longer matches the
      // background image/splash and read as two disconnected screens.
      backgroundColor: "#ffffff",
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
    // Verified App Links so payment-redirect flows (Razorpay/UPI apps)
    // return here via a real https link rather than only the bare
    // darziapp:// custom scheme. Requires hosting
    // /.well-known/assetlinks.json on this domain (see
    // public/.well-known/assetlinks.json in the web repo) with the real
    // release-keystore SHA-256 fingerprint filled in - see that file's TODO.
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "bookmydarzi.com",
            pathPrefix: "/app",
          },
        ],
        category: ["BROWSABLE", "DEFAULT"],
      },
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
          // Matches Expo SDK 54's own default (36 = Android 16) - Google
          // requires new app submissions to target API 36 starting
          // 2026-08-31 (existing apps get until 2026-11-01 with an
          // extension). This was previously pinned to 35, one version
          // behind this SDK's actual baseline.
          compileSdkVersion: 36,
          targetSdkVersion: 36,
        },
        ios: {
          // SDK 57 requires 16.4+ (expo-build-properties hard-fails config
          // resolution below this) - was 15.1 under SDK 54.
          deploymentTarget: "16.4",
        },
      },
    ],
    "expo-router",
    [
      "expo-splash-screen",
      {
        // Same asset app/splash.tsx renders (the JS-driven splash that
        // follows this native frame) - previously this pointed at
        // splash-icon.png, the round teal-circle app-icon artwork, which is
        // a visibly different image (different crop, different background
        // shape/color) from the actual coded splash screen. That produced
        // exactly the "two disconnected screens flashing in sequence" this
        // comment already warned about, just with the wrong fix: matching
        // colors alone isn't enough if the image itself doesn't match too.
        image: "./assets/logo_cropped.png",
        imageWidth: 260,
        resizeMode: "contain",
        backgroundColor: "#ffffff",
        dark: {
          backgroundColor: "#ffffff",
        },
        // Android 12+ (API 31+) forces its OWN native splash on cold start,
        // shown before any JS loads - and without this block it falls back
        // to the app's raw adaptiveIcon (the full round mascot artwork)
        // blown up on a plain background, completely unstyled and jarring
        // against the branded splash that follows a beat later.
        //
        // Bug fix: this used to point at the same wide logo_cropped.png as
        // the JS splash above ("so the two frames match exactly"), but that
        // reasoning missed that Android 12+'s native SplashScreen API
        // renders this image inside a fixed circular icon window (~240dp,
        // the same mask shape adaptive icons use) - a wide rectangular logo
        // with text ("BookMyDarzi") gets clipped by that circular mask
        // regardless of resizeMode/imageWidth, which only govern the later
        // JS-driven splash (app/splash.tsx), not this native frame. That's
        // what produced the "kMyDar" cropped text seen on real devices.
        // android-icon-foreground.png is the adaptive-icon-safe asset
        // (square canvas, content already kept inside the safe zone for
        // exactly this kind of circular mask) - using it here avoids the
        // clip. The JS splash a beat later still shows the full wide logo
        // via logo_cropped.png/imageWidth above, unaffected by this.
        android: {
          image: "./assets/images/android-icon-foreground.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#ffffff",
          },
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
    [
      "expo-audio",
      {
        microphonePermission:
          "Allow BookMyDarzi to access your microphone to record a voice note for your tailor.",
        // Voice notes are recorded and played back only while the customer
        // is actively in the app (checkout/order screens) - never in the
        // background. expo-audio defaults enableBackgroundPlayback to true,
        // which pulls in the Android FOREGROUND_SERVICE_MEDIA_PLAYBACK
        // permission - Play Console then requires a video demonstrating
        // genuine background media playback to justify that permission,
        // which this app doesn't have and doesn't need. Disabling both
        // background flags removes the permission from the manifest
        // entirely, matching what this feature actually does.
        enableBackgroundPlayback: false,
        enableBackgroundRecording: false,
      },
    ],
    ...(isLocalDevBuild ? ["./plugins/withCleartextTraffic.js"] : []),
    "./plugins/withRazorpayGradle.js",
    // Sentry's build-time source-map/debug-symbol upload is disabled via
    // the SENTRY_DISABLE_AUTO_UPLOAD / SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD
    // env vars (set in eas.json) instead of a plugin option here -
    // sentry.gradle's own upload Gradle task only reads those two env
    // vars, not any app.config.js plugin setting. Without them, sentry-cli
    // has no org/project/auth-token to upload to and fails the whole
    // Gradle build. Sentry error reporting itself still works via
    // EXPO_PUBLIC_SENTRY_DSN. Re-enable once Sentry is properly configured.
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
