const CACHE_NAME = "ptmip-attendance-v7";
const PRECACHE_ASSETS = ["/", "/manifest.json", "/icon-192.png"];

// Install: precache minimal assets
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

// Activate: delete old caches only, keep current
self.addEventListener("activate", (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
});

// Helper: safely fetch then cache (clone SYNCHRONOUSLY before return)
function fetchAndCache(request) {
  return fetch(request).then((response) => {
    if (response && response.ok) {
      const cloned = response.clone(); // MUST clone sync before body consumed
      caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
    }
    return response;
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") return;

  const url = new URL(event.request.url);

  // =============================================================
  // RULE 1: /api/* dan /uploads/* — BYPASS 100%, jangan disentuh
  // API harus selalu langsung ke server (tidak boleh dari cache)
  // =============================================================
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/uploads/")) {
    return;
  }

  // =============================================================
  // RULE 2: Hashed assets (/assets/index-xxxx.js, .css)
  // Cache-first: hash berubah setiap deploy, aman di-cache
  // =============================================================
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetchAndCache(event.request).catch(() => caches.match("/"));
      })
    );
    return;
  }

  // =============================================================
  // RULE 3: Semua route lainnya (SPA routes + manifest + icon)
  // Network-first, fallback ke cached index.html jika offline
  // =============================================================
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache hanya root "/" untuk offline fallback
        if (response && response.ok && url.pathname === "/") {
          const cloned = response.clone(); // Clone sync!
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, cloned));
        }
        return response;
      })
      .catch(async () => {
        // Offline fallback: kembalikan cached index.html
        const cached = await caches.match("/");
        return cached || new Response("<h2>Sedang offline. Periksa koneksi internet.</h2>", {
          headers: { "Content-Type": "text/html" },
        });
      })
  );
});

// Push Notification
self.addEventListener("push", (event) => {
  let data = { title: "PT MIP", body: "Ada pengumuman baru!" };
  if (event.data) {
    try { data = event.data.json(); } catch { data = { title: "PT MIP", body: event.data.text() }; }
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: data.url || "/",
    })
  );
});

// Notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = event.notification.data || "/";
  const targetUrl = self.registration.scope.replace(/\/$/, "") +
    (targetPath.startsWith("/") ? targetPath : "/" + targetPath);
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (new URL(client.url).origin === new URL(self.registration.scope).origin && "focus" in client) {
          client.focus();
          if ("navigate" in client) return client.navigate(targetUrl);
          return;
        }
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
