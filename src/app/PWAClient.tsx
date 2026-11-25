"use client";
import { useEffect, useState } from "react";
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }> };
export default function PWAClient() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIOSHelp, setShowIOSHelp] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(error => console.error("ALNAV DMS SW registration failed:", error));
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    if (standalone) { setInstalled(true); return; }
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    if (isIOS) { setVisible(true); if (new URLSearchParams(window.location.search).get("install") === "ios") setShowIOSHelp(true); }
    const onBeforeInstall = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallPromptEvent); setVisible(true); };
    const onInstalled = () => { setInstalled(true); setVisible(false); setInstallEvent(null); };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", onBeforeInstall); window.removeEventListener("appinstalled", onInstalled); };
  }, []);
  async function install() {
    if (!installEvent) { setShowIOSHelp(true); return; }
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") { setInstalled(true); setVisible(false); }
    setInstallEvent(null);
  }
  if (!visible || installed) return null;
  return <aside className="pwa-install-card" aria-label="Install ALNAV DMS">
    <div className="pwa-install-copy"><strong>Install ALNAV DMS</strong><span>Tambahkan ALNAV DMS ke perangkat sebagai aplikasi.</span>
      {showIOSHelp && <span className="pwa-ios-help">Di Safari: tekan Bagikan, lalu pilih “Add to Home Screen” / “Tambahkan ke Layar Utama”.</span>}
    </div>
    <div className="pwa-install-actions"><button type="button" onClick={install}>INSTALL</button><button type="button" className="pwa-dismiss" aria-label="Tutup" onClick={() => setVisible(false)}>×</button></div>
  </aside>;
}