import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Estoque",
  owner: "brennersardinha",
  slug: "estoque-inventario",
  version: "0.3.5",
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
    apiUrl: process.env.EXPO_PUBLIC_API_URL ?? null,
    apiPort: Number(process.env.EXPO_PUBLIC_API_PORT ?? 3000),
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
      NSCameraUsageDescription: "A câmera é usada para identificar produtos no inventário.",
      NSLocalNetworkUsageDescription: "O acesso à rede local é usado para encontrar o servidor do estoque da loja.",
      NSAppTransportSecurity: { NSAllowsLocalNetworking: true }
    }
  },
  android: {
    package: "com.projetoestoque.inventario",
    versionCode: 9,
    permissions: ["CAMERA", "ACCESS_NETWORK_STATE", "ACCESS_WIFI_STATE"]
  }
};

export default config;
