import type { Metadata, Viewport } from "next";
import "./globals.css";
import PWAClient from "./PWAClient";
export const metadata: Metadata = {
  title: "ALNAV DMS | KRI Alamang-644",
  description: "Sistem administrasi, logbook, pemeliharaan, logistik dan personel KRI Alamang-644.",
  applicationName: "ALNAV DMS", manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "ALNAV DMS", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/navyhub-icon.svg", type: "image/svg+xml" }], apple: [{ url: "/alamang-emblem.jpg", type: "image/jpeg" }] },
  formatDetection: { telephone: false }
};
export const viewport: Viewport = { themeColor: "#07111f", width: "device-width", initialScale: 1, viewportFit: "cover" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="id"><body>{children}<PWAClient /></body></html>;
}