/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: "com.pdrukker.europoi",
  appName: "EuroPoi",
  webDir: "build",
  server: {
    androidScheme: "https",
    allowNavigation: [
      "api.elevenlabs.io",
      "*.tile.openstreetmap.org",
      "server.arcgisonline.com",
      "unpkg.com",
    ],
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#020a1a",
      showSpinner: false,
    },
    StatusBar: {
      style: "Dark", // lichte icoontjes op donkere achtergrond
      backgroundColor: "#020a1a",
      overlaysWebView: false, // verberg de statusbalk volledig
    },
    NavigationBar: {
      backgroundColor: "#020a1a",
      darkButtons: false, // lichte knoppen
    },
  },
};

module.exports = config;
