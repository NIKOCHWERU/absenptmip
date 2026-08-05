const CACHE_NAME = "ptmip-attendance-v6-spa";
const PRECACHE_ASSETS = ["/", "/manifest.json", "/icon-192.png"];

// Install: precache assets
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
});

// Activate: delete ALL old caches, claim clients
self.addEventListener("activate", (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== CACHE_NAME)
          .map((n) => {
            console.log("🧹 SW v6: Deleting old cache:", n);
            return caches.delete(n);
          })
      )
    )
  );
});

self.addEventListener("fetch", (event) => {
  // Skip non-GET and cross-origin requests
  if (event.request.method !== "GET") return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Skip in development
  const hostname = self.location.hostname;
  if (hostname === "localhost" || hostname === "127.0.0.1") return;

  const url = new URL(event.request.url);

  // ============================================================
  // RULE 1: /api/* — ALWAYS bypass SW, fetch directly from server
  // Never cache API responses (ensures real-time overtime data)
  // ============================================================
  if (url.pathname.startsWith("/api/")) {
    return; // No event.respondWith = browser handles natively
  }

  // ============================================================
  // RULE 2: /uploads/* — bypass SW (user uploaded files)
  // ============================================================
  if (url.pathname.startsWith("/uploads/")) {
    return;
  }

  // ============================================================
  // RULE 3: Hashed static assets (/assets/*.js, /assets/*.css)
  // Cache-first (they have unique hash names so safe to cache)
  // ============================================================
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => caches.match("/"));
      })
    );
    return;
  }

  // ============================================================
  // RULE 4: Static files (manifest, icon, sw.js)
  // Network-first, cache fallback
  // ============================================================
  if (
    url.pathname === "/manifest.json" ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/sw.js"
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ============================================================
  // RULE 5: SPA routes (/, /employee, /admin/*, /login, etc.)
  // Network-first → if fail, serve cached index.html (offline support)
  // ============================================================
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache the root / for offline fallback
        if (response && response.status === 200 && url.pathname === "/") {
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response.clone()));
        }
        return response;
      })
      .catch(async () => {
        // Offline: serve cached root index.html for all SPA routes
        const cached = await caches.match("/");
        if (cached) return cached;
        return new Response("<h2>Aplikasi sedang offline. Silakan periksa koneksi internet Anda.</h2>", {
          headers: { "Content-Type": "text/html" },
        });
      })
  );
});

// Push Notification handler
self.addEventListener("push", (event) => {
  let data = { title: "PT MIP", body: "Ada pengumuman baru!" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "PT MIP", body: event.data.text() };
    }
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

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetPath = event.notification.data || "/";
  const targetUrl =
    self.registration.scope.replace(/\/$/, "") +
    (targetPath.startsWith("/") ? targetPath : "/" + targetPath);
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
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
