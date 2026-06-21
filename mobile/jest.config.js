module.exports = {
  preset: "jest-expo",
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|drizzle-orm|expo-crypto|expo-haptics|expo-sqlite|expo-linear-gradient|expo-blur|nativewind|react-native-reanimated|react-native-gesture-handler|react-native-safe-area-context|react-native-screens|react-native-worklets|@testing-library)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  setupFiles: ["<rootDir>/jest.setup.js"],
};
