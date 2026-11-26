import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "ALNAV DMS — KRI Alamang-644", short_name: "ALNAV DMS",
    description: "Integrated naval data management system for KRI Alamang-644.",
    start_url: "/", scope: "/", display: "standalone", display_override: ["standalone", "minimal-ui"],
    orientation: "any", background_color: "#07111f", theme_color: "#07111f",
    categories: ["business", "productivity", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}