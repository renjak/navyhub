import type { CapacitorConfig } from "@capacitor/cli";
/**
 * Private network-connected NAVYHUB shell.
 * The app has a protected Next.js GPS API route, so do not static-export it.
 * This remote HTTPS shell is for controlled internal distribution only,
 * not public App Store submission. It requires an internet connection.
 */
const config: CapacitorConfig = {
  appId: "id.navyhub.app", appName: "NAVYHUB", webDir: "www",
  server: { url: "https://navyhub.app", cleartext: false, allowNavigation: ["navyhub.app"] },
  android: { allowMixedContent: false }
};
export default config;