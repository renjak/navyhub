"use client";

import { useEffect, useState } from "react";

type Platform = "android" | "ios" | "other";

export default function DownloadPage() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent || "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/i.test(ua);
    const next: Platform = isIOS ? "ios" : isAndroid ? "android" : "other";
    setPlatform(next);
    setDetected(true);

    // iOS uses the existing production PWA; Android waits for the signed APK release.
    if (next === "ios") {
      window.location.replace("/?install=ios");
    }
  }, []);

  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24, color: "#eef7ff", background: "radial-gradient(circle at 50% 0%, #183b55 0, #091827 48%, #050b13 100%)", fontFamily: "Arial, sans-serif" }}>
      <section style={{ width: "min(100%, 520px)", padding: 28, border: "1px solid rgba(153,195,225,.28)", borderRadius: 24, background: "rgba(13,29,45,.82)", boxShadow: "0 24px 80px rgba(0,0,0,.35)" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: "#8fc7e5", fontWeight: 800 }}>KRI ALAMANG-644 · PRIVATE APP</div>
        <h1 style={{ margin: "12px 0 8px", fontSize: 34, letterSpacing: 2 }}>NAVYHUB</h1>
        <p style={{ margin: 0, color: "#b9ccda", lineHeight: 1.65 }}>Portal instalasi resmi NAVYHUB untuk perangkat personel.</p>
        {!detected ? (
          <p style={{ marginTop: 26, color: "#a8c5d8" }}>Mendeteksi perangkat…</p>
        ) : platform === "android" ? (
          <div style={{ marginTop: 26, padding: 18, borderRadius: 16, background: "rgba(255,255,255,.045)", border: "1px solid rgba(143,199,229,.2)" }}>
            <div style={{ fontSize: 12, color: "#8fc7e5", fontWeight: 800, letterSpacing: 1 }}>ANDROID DETECTED</div>
            <h2 style={{ margin: "9px 0", fontSize: 20 }}>APK sedang disiapkan</h2>
            <p style={{ color: "#bfd0dc", lineHeight: 1.6, fontSize: 14 }}>Paket APK bertanda tangan belum dirilis. Instalasi akan diaktifkan setelah signing key organisasi disiapkan dan build Android diverifikasi. Jangan memasang APK dari tautan tidak resmi.</p>
            <a href="/" style={{ display: "inline-flex", marginTop: 12, padding: "12px 16px", borderRadius: 11, background: "#17658a", color: "white", textDecoration: "none", fontWeight: 800 }}>Buka NAVYHUB versi web</a>
          </div>
        ) : (
          <div style={{ marginTop: 26, padding: 18, borderRadius: 16, background: "rgba(255,255,255,.045)", border: "1px solid rgba(143,199,229,.2)" }}>
            <div style={{ fontSize: 12, color: "#8fc7e5", fontWeight: 800, letterSpacing: 1 }}>DESKTOP / OTHER DEVICE</div>
            <h2 style={{ margin: "9px 0", fontSize: 20 }}>Pilih perangkat untuk instalasi</h2>
            <p style={{ color: "#bfd0dc", lineHeight: 1.6, fontSize: 14 }}>Buka tautan ini dari Safari pada iPhone/iPad untuk memasang NAVYHUB sebagai PWA, atau dari Android setelah APK signed tersedia.</p>
            <a href="/" style={{ display: "inline-flex", marginTop: 12, padding: "12px 16px", borderRadius: 11, background: "#17658a", color: "white", textDecoration: "none", fontWeight: 800 }}>Buka NAVYHUB</a>
          </div>
        )}
        <p style={{ marginTop: 24, marginBottom: 0, color: "#8299aa", fontSize: 11, lineHeight: 1.6 }}>Gunakan hanya akun personel yang telah diotorisasi. Data operasional tetap memerlukan koneksi internet dan autentikasi NAVYHUB.</p>
      </section>
    </main>
  );
}
