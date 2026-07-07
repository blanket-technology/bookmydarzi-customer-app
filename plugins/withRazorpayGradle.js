/**
 * Patches react-native-razorpay android/build.gradle for Expo SDK 54 / AGP 8+.
 * Runs at prebuild on EAS (after npm install) - does not rely on patch-package alone.
 */
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const RAZORPAY_BUILD_GRADLE = path.join(
  "node_modules",
  "react-native-razorpay",
  "android",
  "build.gradle"
);

function patchRazorpayBuildGradle(contents) {
  let next = contents;

  if (next.includes("react-native:+")) {
    next = next.replace(
      /implementation\s+['"]com\.facebook\.react:react-native:\+['"]/,
      'implementation("com.facebook.react:react-android")'
    );
  }

  if (!next.includes('namespace "com.razorpay.rn"') && !next.includes("namespace 'com.razorpay.rn'")) {
    next = next.replace(/android\s*\{/, 'android {\n    namespace "com.razorpay.rn"');
  }

  return next;
}

function withRazorpayGradle(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const gradlePath = path.join(config.modRequest.projectRoot, RAZORPAY_BUILD_GRADLE);

      if (!fs.existsSync(gradlePath)) {
        console.warn("[withRazorpayGradle] react-native-razorpay android/build.gradle not found - skip");
        return config;
      }

      const original = fs.readFileSync(gradlePath, "utf8");
      const patched = patchRazorpayBuildGradle(original);

      if (patched !== original) {
        fs.writeFileSync(gradlePath, patched);
        console.log("[withRazorpayGradle] Patched react-native-razorpay for Expo Android build");
      }

      return config;
    },
  ]);
}

module.exports = withRazorpayGradle;
