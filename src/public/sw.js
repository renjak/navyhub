/* NAVYHUB PWA. Never cache authenticated HTML, Supabase responses, API payloads or user records. */
const CACHE_VERSION = "navyhub-static-v1";
const OFFLINE_URL = "/offline.html";
const APP_ASSETS = [OFFLINE_URL, "/alamang-emblem.jpg", "/kri-alamang-bg.jpg"];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_VERSION).then(cache => cache.addAll(APP_ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("navyhub-") && key !== CACHE_VERSION).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate" || url.pathname.startsWith("/api/")) {
    if (request.mode !== "navigate") return;
    event.respondWith(fetch(request).catch(async () => (await caches.match(OFFLINE_URL)) || new Response("NAVYHUB memerlukan koneksi internet.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } })));
    return;
  }
  const staticAsset = url.pathname.startsWith("/_next/static/") || ["/alamang-emblem.jpg", "/kri-alamang-bg.jpg"].includes(url.pathname);
  if (!staticAsset) return;
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && (response.type === "basic" || response.type === "default")) caches.open(CACHE_VERSION).then(cache => cache.put(request, response.clone()));
    return response;
  })));
});