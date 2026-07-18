jest.mock("expo-file-system", () => {
  const store = {};
  const api = {
    Paths: { document: "mock-doc-dir" },
    File: jest.fn().mockImplementation((dir, name) => ({
      get path() { return `${dir}/${name}`; },
       get exists() { return !!store[this.path]; },
       async text() { return store[this.path] || ""; },
       textSync() { return store[this.path] || ""; },
      write(content) { store[this.path] = content; },
      delete() { delete store[this.path]; },
    })),
    Directory: jest.fn().mockImplementation((dir, name) => ({
      get path() { return `${dir}/${name}`; },
      get exists() { return true; },
      create() {},
    })),
    __resetStore() { Object.keys(store).forEach(k => delete store[k]); },
  };
  return api;
});

jest.mock("expo-haptics", () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
    Rigid: "rigid",
    Soft: "soft",
  },
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(() => "test-uuid-" + Math.random().toString(36).slice(2)),
}));

jest.mock("expo-sqlite", () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    getFirstSync: jest.fn(() => ({ user_version: 2 })),
    getAllSync: jest.fn(() => []),
    runSync: jest.fn(),
  })),
}));

jest.mock("expo-linear-gradient", () => {
  const { View } = require("react-native");
  return {
    LinearGradient: View,
  };
});

jest.mock("expo-blur", () => {
  const { View } = require("react-native");
  return {
    BlurView: View,
  };
});

jest.mock("react-native-reanimated", () => {
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      ...View,
      createAnimatedComponent: (component) => component,
    },
    useSharedValue: jest.fn(() => ({ value: 0 })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((v) => v),
    withSpring: jest.fn((v) => v),
    interpolate: jest.fn(() => 0),
    Extrapolate: { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" },
  };
});
