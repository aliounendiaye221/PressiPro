import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pressipro.app",
  appName: "PressiPro",
  webDir: "mobile-web",
  server: {
    // En production, l'application native charge l'application SaaS canonique en direct
    url: process.env.CAPACITOR_SERVER_URL || "https://pressipro.vercel.app",
    errorPath: "offline.html",
    cleartext: process.env.NODE_ENV === "development",
    androidScheme: "https",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      // Auto-hide activé pour éviter tout gel infini si l'appareil démarre sans réseau
      launchAutoHide: true,
      backgroundColor: "#2563eb",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#2563eb",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV === "development",
  },
  ios: {
    contentInset: "always",
    preferredContentMode: "mobile",
    scheme: "PressiPro",
  },
};

export default config;
