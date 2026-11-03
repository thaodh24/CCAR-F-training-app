// Offline support. App files: served from cache, refreshed in the background.
// MP3s: kept in a separate cache only when the user taps "Tải về" (download) in the Listen tab.
const APP = "ccarf-app-v2", AUDIO = "ccarf-audio";
const FILES = ["./", "./index.html", "./qbank.js", "./audio/tracks.json", "./audio/durations.json", "./manifest.webmanifest", "./icons/icon-180.png", "./icons/icon-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(APP).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {}))))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== APP && k !== AUDIO).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith(".mp3")) {
    // Audio: downloaded copy first, otherwise stream from the network (Range requests pass through).
    e.respondWith(caches.open(AUDIO).then(c => c.match(url.pathname).then(hit => {
      if (!hit) return fetch(req);
      const range = req.headers.get("range");
      if (!range) return hit;
      return hit.arrayBuffer().then(buf => {           // Safari needs 206 answers for <audio>
        const m = /bytes=(\d+)-(\d*)/.exec(range), start = +m[1], end = m[2] ? +m[2] : buf.byteLength - 1;
        return new Response(buf.slice(start, end + 1), { status: 206, headers: {
          "Content-Type": "audio/mpeg", "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
          "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
      });
    })));
    return;
  }
  e.respondWith(caches.open(APP).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  })));
});
