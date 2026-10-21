import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Estoque",
  owner: "brennersardinha",
  slug: "estoque-inventario",
  version: "0.3.4",
  orientation: "portrait",
  userInterfaceStyle: "light",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/logo-full.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff"
  },
  scheme: "estoque",
  platforms: ["android", "ios"],
  extra: {
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? "http://192.168.15.8:3000/api",
    eas: {
      projectId: "7007b09a-fe02-4539-b3af-8129bfce3bfb"
    }
  },
  plugins: [
    [
      "expo-camera",
      {
        cameraPermission: "Permita que o Estoque use a câmera para ler códigos de barras e QR Codes."
      }
    ],
    ["expo-build-properties", { android: { usesCleartextTraffic: true } }],
    "expo-secure-store"
  ],
  ios: {
    bundleIdentifier: "com.projetoestoque.inventario",
    supportsTablet: false,
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: "A câmera é usada para identificar produtos no inventário."
    }
  },
  android: {
    package: "com.projetoestoque.inventario",
    versionCode: 8,
    permissions: ["CAMERA"]
  }
};

export default config;
