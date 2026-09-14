/// <reference lib="webworker" />

export {};

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision?: string | null }>;
};

const APP_SHELL_CACHE = "kiosk-app-shell-v1";

function contentVersion(name: string) {
  const match = /^content-v(\d+)$/.exec(name);
  return match ? Number(match[1]) : -1;
}

async function matchNewestContent(request: Request) {
  const names = (await caches.keys())
    .filter((name) => name.startsWith("content-v"))
    .sort((left, right) => contentVersion(right) - contentVersion(left));
  for (const name of names) {
    const match = await (await caches.open(name)).match(request);
    if (match) return match;
  }
  return undefined;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_SHELL_CACHE);
    const urls = self.__WB_MANIFEST.map((entry) => new URL(entry.url, self.registration.scope).toString());
    await cache.addAll(urls);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  if (url.origin === self.location.origin && url.pathname.startsWith("/media/")) {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request);
        if (response.ok) return response;
      } catch {
        // Fall through to the verified published content cache.
      }
      return (await matchNewestContent(event.request)) ?? new Response("Media offline tidak tersedia", { status: 503 });
    })());
    return;
  }

  if (url.origin === self.location.origin && url.pathname.startsWith("/kiosk/")) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      try {
        return await fetch(event.request);
      } catch {
        const shell = await caches.open(APP_SHELL_CACHE);
        return (await shell.match(new URL("index.html", self.registration.scope).toString()))
          ?? new Response("Kiosk offline", { status: 503 });
      }
    })());
  }
});
