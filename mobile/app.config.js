const IS_DEV = process.env.APP_VARIANT === "development";
const IS_PREVIEW = process.env.APP_VARIANT === "preview";

const getAppBundleId = () => {
  if (IS_DEV) return "com.tars.app.dev";
  if (IS_PREVIEW) return "com.tars.app.preview";
  return "com.tars.app";
};

const getAppName = () => {
  if (IS_DEV) return "Tars (Dev)";
  if (IS_PREVIEW) return "Tars (Preview)";
  return "Tars";
};

const getScheme = () => {
  if (IS_DEV) return "tars-dev";
  if (IS_PREVIEW) return "tars-preview";
  return "tars";
};

export default {
  expo: {
    name: getAppName(),
    slug: "tars",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    scheme: getScheme(),
    ios: {
      supportsTablet: true,
      bundleIdentifier: getAppBundleId(),
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
      package: getAppBundleId(),
      usesCleartextTraffic: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.INTERNET",
        "android.permission.RECORD_AUDIO",
        "android.permission.MODIFY_AUDIO_SETTINGS",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
      ],
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    plugins: [
      "expo-dev-client",
      "expo-router",
      "expo-sqlite",
      "expo-audio",
      "expo-status-bar",
    ],
    extra: {
      router: {
        scheme: getScheme(),
      },
      eas: {
        projectId: "50debe70-38b2-487c-8cc9-0c5a14e1ebf4",
      },
    },
  },
};
