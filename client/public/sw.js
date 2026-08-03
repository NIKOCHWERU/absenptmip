const CACHE_NAME = "ptmip-attendance-v4-pwa-refresh";
const ASSETS = [
  "/",
  "/manifest.json",
  "/icon-192.png"
];

// Install Event - skip waiting immediately
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate Event - clean up ALL old caches and claim clients immediately
self.addEventListener("activate", (event) => {
  self.clients.claim();
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          console.log("🧹 SW: Purging cache on activate:", cache);
          return caches.delete(cache);
        })
      );
    })
  );
});

// Fetch Event - Network-First Strategy for PWA
self.addEventListener("fetch", (event) => {
  // Bypass service worker in development
  if (self.location.hostname === "localhost" || self.location.hostname === "127.0.0.1") {
    return;
  }

  // Only handle GET requests from our origin
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  const url = new URL(event.request.url);

  // Network-First for HTML, JS, CSS, and API/Manifest
  if (
    url.pathname === "/" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname === "/manifest.json"
  ) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
            return response;
          }
          // If 404 on an old hashed asset chunk, purge cache and serve /
          if (response && response.status === 404 && url.pathname.startsWith("/assets/")) {
            console.warn("🧹 SW: Asset 404 detected, purging cache for new deployment...");
            const names = await caches.keys();
            await Promise.all(names.map((n) => caches.delete(n)));
            return fetch("/?t=" + Date.now());
          }
          return response;
        })
        .catch(async () => {
          // Fallback to cache if offline
          const cached = await caches.match(event.request);
          if (cached) return cached;
          return caches.match("/");
        })
    );
    return;
  }

  // Stale-while-revalidate for images & static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone());
            });
          }
        }).catch(() => {});
        return cachedResponse;
      }
      return fetch(event.request);
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

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: data.url || "/",
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Click notification handler
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const targetUrl = event.notification.data || "/";
      for (const client of clientList) {
        if (client.url === targetUrl && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
