import type { PublishedManifest } from "@ads-kiosk/shared";

const DB_NAME = "ads-kiosk-brin";
const DB_VERSION = 1;
const STORE_NAME = "state";
const ACTIVE_MANIFEST_KEY = "activeManifest";
const ACTIVE_VERSION_KEY = "activeVersion";

export type VersionStateStore = {
  readActiveManifest(): Promise<PublishedManifest | null>;
  readActiveVersion(): Promise<number | null>;
  writeActive(manifest: PublishedManifest): Promise<void>;
};

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB gagal dibuka"));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function readValue<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  try {
    return await new Promise<T | null>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(key);
      request.onerror = () => reject(request.error ?? new Error(`IndexedDB read gagal: ${key}`));
      request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    });
  } finally {
    db.close();
  }
}

async function writeActive(manifest: PublishedManifest): Promise<void> {
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.put(manifest, ACTIVE_MANIFEST_KEY);
      store.put(manifest.version, ACTIVE_VERSION_KEY);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB write gagal"));
      transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction dibatalkan"));
    });
  } finally {
    db.close();
  }
}

export const browserVersionStateStore: VersionStateStore = {
  readActiveManifest: () => readValue<PublishedManifest>(ACTIVE_MANIFEST_KEY),
  readActiveVersion: () => readValue<number>(ACTIVE_VERSION_KEY),
  writeActive,
};
