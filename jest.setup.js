// Project-wide test setup; add to it as it grows.
//
// async-storage and netinfo are deliberately NOT mocked here: moduleNameMapper
// in jest.config.js already redirects both to their shipped mocks. Doing it in
// both places recurses forever -- the factory's require() resolves straight
// back through the mapper into itself and every suite dies with
// "Maximum call stack size exceeded".

// expo-font reaches for the native ExpoFontLoader as soon as it is imported,
// and @expo/vector-icons imports it transitively from every icon component.
// Under jest-expo that native lookup crashes the whole suite (see the note in
// jest.config.js), so stub the small surface @expo/vector-icons actually uses:
// fonts are always "already loaded", which is what these tests want anyway.
jest.mock("expo-font", () => ({
  loadAsync: jest.fn(async () => {}),
  unloadAsync: jest.fn(async () => {}),
  unloadAllAsync: jest.fn(async () => {}),
  isLoaded: jest.fn(() => true),
  isLoading: jest.fn(() => false),
  getLoadedFonts: jest.fn(() => []),
  renderToImageAsync: jest.fn(async () => ({ uri: "", width: 0, height: 0 })),
  useFonts: jest.fn(() => [true, null]),
}));

// expo-constants pulls in the native ExponentConstants module on import and
// hits the same jest-expo crash. Mirror the app.json values the app actually
// reads so version/identifier lookups return something realistic in tests.
jest.mock("expo-constants", () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: "1.0.0",
      extra: { eas: { projectId: "test-project-id" } },
      ios: { bundleIdentifier: "com.serviceos.staff", buildNumber: "1" },
      android: { package: "com.serviceos.staff", versionCode: 1 },
    },
  },
}));

// expo-asset is never imported by app code -- it arrives transitively through
// expo-notifications -> expo -> Expo.fx -- but it touches the native ExpoAsset
// module on import and trips the same crash, so stub the class shape.
jest.mock("expo-asset", () => {
  class Asset {
    constructor(options = {}) {
      Object.assign(this, { name: "", type: "", uri: "", localUri: null }, options);
    }
    static fromModule = jest.fn(() => new Asset());
    static fromURI = jest.fn((uri) => new Asset({ uri }));
    static loadAsync = jest.fn(async () => []);
    downloadAsync = jest.fn(async () => this);
  }
  return { __esModule: true, Asset, useAssets: jest.fn(() => [undefined, undefined]) };
});

// expo-application is only reached transitively through expo-notifications.
jest.mock("expo-application", () => ({
  __esModule: true,
  applicationId: "com.serviceos.staff",
  applicationName: "Fuvay Staff",
  nativeApplicationVersion: "1.0.0",
  nativeBuildVersion: "1",
  getInstallationTimeAsync: jest.fn(async () => new Date(0)),
}));

// expo-notifications is used directly by pushRegistration.ts. Permissions
// default to "undetermined" so tests exercise the request path; individual
// suites override these with mockResolvedValue as needed.
jest.mock("expo-notifications", () => ({
  __esModule: true,
  getPermissionsAsync: jest.fn(async () => ({ status: "undetermined" })),
  requestPermissionsAsync: jest.fn(async () => ({ status: "granted" })),
  getExpoPushTokenAsync: jest.fn(async () => ({ data: "ExponentPushToken[test]" })),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
}));

// expo-image-picker: permissions granted, pickers cancelled by default so a
// suite that does not care about picking gets a harmless no-op.
jest.mock("expo-image-picker", () => ({
  __esModule: true,
  MediaTypeOptions: { Images: "Images", Videos: "Videos", All: "All" },
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true, assets: null })),
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ status: "granted", granted: true })),
}));

// react-native-screens' native views (RNSScreen) aren't available under
// react-test-renderer -- disable native screen optimization in tests so
// native-stack/bottom-tabs render with plain Views instead of crashing.
try {
  // eslint-disable-next-line global-require
  require("react-native-screens").enableScreens(false);
} catch {
  // react-native-screens not present in this environment -- best effort only.
}
