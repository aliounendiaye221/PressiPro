const CACHE_NAME = "pressipro-v7";
const OFFLINE_URL = "/offline";

// App shell public uniquement : ne jamais pré-cacher des routes protégées
// qui redirigeraient vers /login lors de la première installation non connectée.
const PRECACHE_URLS = [
  "/",
  "/offline",
  "/login",
  "/register",
  "/favicon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-192.svg",
  "/icon-512.svg",
  "/manifest.json",
];

function isCacheableResponse(response) {
  return Boolean(
    response &&
      response.ok &&
      !response.redirected &&
      response.type !== "opaque"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.allSettled(
        PRECACHE_URLS.map((url) =>
          fetch(url, { credentials: "same-origin" }).then((res) => {
            if (isCacheableResponse(res)) {
              return cache.put(url, res);
            }
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Purge des pages authentifiées lors du logout ou changement de pressing (impersonation)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLEAR_USER_CACHE") {
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const requests = await cache.keys();
        await Promise.all(
          requests.map((req) => {
            const url = new URL(req.url);
            const isPublicAsset =
              PRECACHE_URLS.includes(url.pathname) ||
              url.pathname.startsWith("/_next/static/") ||
              /\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ico)$/i.test(url.pathname);
            if (!isPublicAsset) {
              return cache.delete(req);
            }
          })
        );
      })
    );
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Ignorer les requêtes non-GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Ne jamais mettre en cache les appels API, les payloads RSC dynamiques (_rsc), ni les reçus publics
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/share/receipt/") ||
    url.searchParams.has("_rsc")
  ) {
    return;
  }

  // Navigations HTML : réseau d'abord, repli sur le cache non-redirigé, puis page /offline
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Assets statiques immuables : cache-first (JS, CSS, images, polices)
  if (
    /\.(js|css|svg|png|jpg|jpeg|webp|woff2?|ico)$/i.test(url.pathname) ||
    url.pathname.startsWith("/_next/static/")
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (isCacheableResponse(response)) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => new Response("", { status: 503 }));
      })
    );
    return;
  }

  // Autres requêtes same-origin : network-first avec repli cache
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (isCacheableResponse(response)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then(
            (cached) => cached || new Response("Hors ligne", { status: 503 })
          )
        )
    );
  }
});
