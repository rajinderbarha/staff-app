// Jest config lives here rather than in package.json so this env var can be
// set before Jest spawns its workers (they inherit process.env), which is the
// only point early enough to matter.
//
// Expo SDK 56 made `expo/fetch` the default `globalThis.fetch`. Under
// jest-expo that getter loads the *native* ExpoFetchModule, and jest-expo's
// `attemptLookup` walks the stack for the owning package.json -- when that
// walk comes up empty it passes null to path.join and every suite dies with
// `The "path" argument must be of type string. Received null` before a single
// test runs. `EXPO_PUBLIC_USE_RN_FETCH` is Expo's documented opt-out; setting
// it here keeps React Native's fetch in tests only, leaving the app itself on
// expo/fetch at runtime.
process.env.EXPO_PUBLIC_USE_RN_FETCH = "1";

module.exports = {
  preset: "jest-expo",
  // jest.setup.js existed but was never wired up before -- its mocks run here
  // now, ahead of each test file's imports.
  setupFiles: ["<rootDir>/jest.setup.js"],
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
  moduleNameMapper: {
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock.js",
    "^@react-native-community/netinfo$":
      "<rootDir>/node_modules/@react-native-community/netinfo/jest/netinfo-mock.js",
  },
};
