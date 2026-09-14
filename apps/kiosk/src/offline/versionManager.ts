import type { PublishedManifest } from "@ads-kiosk/shared";
import { sha256Hex } from "./checksum";
import { browserVersionStateStore, type VersionStateStore } from "./db";

export type { VersionStateStore } from "./db";

export type ContentCache = {
  put(url: string, response: Response): Promise<void>;
};

export type ContentCacheStorage = {
  open(name: string): Promise<ContentCache>;
  delete(name: string): Promise<boolean>;
  keys(): Promise<string[]>;
};

export type VersionManagerDependencies = {
  stateStore: VersionStateStore;
  cacheStorage: ContentCacheStorage;
  fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

function browserCacheStorage(): ContentCacheStorage {
  return {
    async open(name) {
      const cache = await caches.open(name);
      return { put: async (url, response) => cache.put(url, response) };
    },
    delete: (name) => caches.delete(name),
    keys: () => caches.keys(),
  };
}

async function removeStaleContentCaches(storage: ContentCacheStorage, activeVersion: number) {
  const keep = new Set([`content-v${activeVersion}`, `content-v${Math.max(1, activeVersion - 1)}`]);
  const names = await storage.keys();
  await Promise.all(names.filter((name) => name.startsWith("content-v") && !keep.has(name)).map((name) => storage.delete(name)));
}

export function createVersionManager(dependencies: VersionManagerDependencies) {
  return {
    async stageAndActivate(manifest: PublishedManifest): Promise<{ activated: boolean; version: number }> {
      const currentVersion = await dependencies.stateStore.readActiveVersion();
      if (currentVersion === manifest.version) return { activated: true, version: manifest.version };

      const cacheName = `content-v${manifest.version}`;
      await dependencies.cacheStorage.delete(cacheName);
      const cache = await dependencies.cacheStorage.open(cacheName);

      try {
        for (const media of manifest.media) {
          const response = await dependencies.fetcher(media.url, { cache: "no-store" });
          if (!response.ok) throw new Error(`Media ${media.id} gagal diunduh: ${response.status}`);

          const bytes = await response.arrayBuffer();
          if (bytes.byteLength !== media.byteSize) throw new Error(`Ukuran media ${media.id} tidak sesuai`);
          const checksum = await sha256Hex(bytes);
          if (checksum !== media.checksum) throw new Error(`Checksum media ${media.id} tidak sesuai`);

          const headers = new Headers(response.headers);
          if (!headers.has("content-type")) headers.set("content-type", media.mimeType);
          headers.set("content-length", String(bytes.byteLength));
          await cache.put(media.url, new Response(bytes, { status: 200, headers }));
        }

        await dependencies.stateStore.writeActive(manifest);
        await removeStaleContentCaches(dependencies.cacheStorage, manifest.version);
        return { activated: true, version: manifest.version };
      } catch {
        await dependencies.cacheStorage.delete(cacheName);
        return { activated: false, version: manifest.version };
      }
    },
  };
}

const browserManager = typeof window !== "undefined" && typeof caches !== "undefined"
  ? createVersionManager({ stateStore: browserVersionStateStore, cacheStorage: browserCacheStorage(), fetcher: fetch.bind(globalThis) })
  : null;

export async function stageAndActivate(manifest: PublishedManifest) {
  if (!browserManager) throw new Error("Offline version manager requires a browser runtime");
  return browserManager.stageAndActivate(manifest);
}
