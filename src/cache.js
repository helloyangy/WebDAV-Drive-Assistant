const DB_NAME = "webdav_cache";
const DB_VERSION = 2;
const META_STORE = "meta";
const BLOB_STORE = "blob";

let dbPromise = null;
let dbInstance = null;

export function openCache() {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "path" });
      }
      let blobStore = null;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        blobStore = db.createObjectStore(BLOB_STORE, { keyPath: "path" });
      } else {
        blobStore = request.transaction.objectStore(BLOB_STORE);
      }
      if (blobStore && !blobStore.indexNames.contains("updatedAt")) {
        blobStore.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => {
      const db = request.result;
      dbInstance = db;
      db.onversionchange = () => {
        try {
          db.close();
        } catch {}
        dbInstance = null;
        dbPromise = null;
      };
      resolve(db);
    };
  });
  return dbPromise;
}

export async function getMeta(path) {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const request = store.get(path);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function setMeta(meta) {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    const store = tx.objectStore(META_STORE);
    const request = store.put(meta);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function listMeta() {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const store = tx.objectStore(META_STORE);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getBlob(path) {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readonly");
    const store = tx.objectStore(BLOB_STORE);
    const request = store.get(path);
    request.onsuccess = () => resolve(request.result?.blob || null);
    request.onerror = () => reject(request.error);
  });
}

export async function setBlob(path, blob) {
  const db = await openCache();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    const store = tx.objectStore(BLOB_STORE);
    const request = store.put({ path, blob, size: blob?.size || 0, updatedAt: Date.now() });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function pruneCache(limitBytes) {
  const db = await openCache();
  const total = await new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readonly");
    const store = tx.objectStore(BLOB_STORE);
    const request = store.openCursor();
    let sum = 0;
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve(sum);
        return;
      }
      const entry = cursor.value || {};
      const size = Number(entry.size ?? entry.blob?.size ?? 0);
      sum += size;
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
  if (total <= limitBytes) {
    return;
  }
  await new Promise((resolve) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    const store = tx.objectStore(BLOB_STORE);
    const source = store.indexNames.contains("updatedAt") ? store.index("updatedAt") : store;
    let remaining = total;
    const request = source.openCursor(null, "next");
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }
      if (remaining <= limitBytes) {
        return;
      }
      const entry = cursor.value || {};
      const size = Number(entry.size ?? entry.blob?.size ?? 0);
      remaining -= size;
      cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

export async function clearCache() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {}
    dbInstance = null;
  }
  dbPromise = null;
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onblocked = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
