import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./theme-dark-glass.css";
import PWAClient from "./PWAClient";
import MotionProvider from "./MotionProvider";
export const metadata: Metadata = {
  title: "ALNAV DMS | KRI Alamang-644",
  description: "Administration, logbook, maintenance, logistics and personnel system for KRI Alamang-644.",
  applicationName: "ALNAV DMS", manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ALNAV DMS", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/favicon.ico", sizes: "48x48" }, { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }] },
  formatDetection: { telephone: false }
};
export const viewport: Viewport = { themeColor: "#050B14", width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body><MotionProvider>{children}</MotionProvider><PWAClient /></body></html>;
}