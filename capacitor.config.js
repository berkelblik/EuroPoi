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
      style: "Dark",
      backgroundColor: "#020a1a",
      overlaysWebView: false,
    },
    NavigationBar: {
      backgroundColor: "#020a1a",
      darkButtons: false,
    },
    // Fused Location Provider instellingen
    BackgroundGeolocation: {
      // Notification voor Android foreground service
      // (vereist zodat Android de app niet throttelt)
      notificationTitle: "EuroPoi navigeert",
      notificationText: "GPS actief",
      notificationIconColor: "#3b82f6",
    },
  },
};

module.exports = config;
