import type { PublishedManifest } from "@ads-kiosk/shared";
import { describe, expect, it } from "vitest";
import { createVersionManager, type ContentCache, type ContentCacheStorage, type VersionStateStore } from "./versionManager";

const manifestV1: PublishedManifest = {
  version: 1,
  publishedAt: "2026-09-14T00:00:00.000Z",
  menuItems: [],
  ads: [],
  settings: { sessionTimeoutSeconds: 60, sessionWarningSeconds: 10, deviceDisplayName: "Kiosk Utama" },
  media: [],
};

const manifestV2: PublishedManifest = {
  ...manifestV1,
  version: 2,
  publishedAt: "2026-09-14T01:00:00.000Z",
  media: [
    { id: "11111111-1111-4111-8111-111111111111", url: "/media/one", mimeType: "image/png", byteSize: 9, checksum: "f89d9092f56d06276191795adbfafa0cc73df5b216c9170b20202cd6b1201771" },
    { id: "22222222-2222-4222-8222-222222222222", url: "/media/two", mimeType: "image/png", byteSize: 9, checksum: "13a83c1e1006fb36a61049bb15979582210bc7a9a06d6f902f7a474764483666" },
  ],
};

function memoryState(initialManifest: PublishedManifest): VersionStateStore & { active: PublishedManifest } {
  return {
    active: initialManifest,
    async readActiveManifest() { return this.active; },
    async readActiveVersion() { return this.active.version; },
    async writeActive(manifest) { this.active = manifest; },
  };
}

function memoryCaches(initial = ["content-v1"]): ContentCacheStorage & { names: Set<string> } {
  const names = new Set(initial);
  const stores = new Map<string, Map<string, Response>>();
  return {
    names,
    async open(name: string): Promise<ContentCache> {
      names.add(name);
      const entries = stores.get(name) ?? new Map<string, Response>();
      stores.set(name, entries);
      return { async put(url, response) { entries.set(url, response); } };
    },
    async delete(name: string) { stores.delete(name); return names.delete(name); },
    async keys() { return [...names]; },
  };
}

describe("versionManager", () => {
  it("keeps version 1 active when any version 2 asset fails verification", async () => {
    const stateStore = memoryState(manifestV1);
    const cacheStorage = memoryCaches();
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/media/one")) return new Response("asset-one", { status: 200, headers: { "content-type": "image/png" } });
      return new Response("unavailable", { status: 503 });
    };
    const manager = createVersionManager({ stateStore, cacheStorage, fetcher });

    const result = await manager.stageAndActivate(manifestV2);

    expect(result).toEqual({ activated: false, version: 2 });
    expect(await stateStore.readActiveVersion()).toBe(1);
    expect(cacheStorage.names.has("content-v1")).toBe(true);
    expect(cacheStorage.names.has("content-v2")).toBe(false);
  });

  it("activates only after all assets pass size and checksum validation", async () => {
    const stateStore = memoryState(manifestV1);
    const cacheStorage = memoryCaches();
    const fetcher = async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.endsWith("/media/one") ? "asset-one" : "asset-two";
      return new Response(body, { status: 200, headers: { "content-type": "image/png" } });
    };
    const manager = createVersionManager({ stateStore, cacheStorage, fetcher });

    const result = await manager.stageAndActivate(manifestV2);

    expect(result).toEqual({ activated: true, version: 2 });
    expect(await stateStore.readActiveVersion()).toBe(2);
    expect(cacheStorage.names.has("content-v2")).toBe(true);
    expect(cacheStorage.names.has("content-v1")).toBe(true);
  });
});
