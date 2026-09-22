const DATABASE = 'vocalis-prepared-audio';
const STORE = 'clips';
const MAX_ITEMS = 512;
const MAX_BYTES = 256 * 1024 * 1024;
const MAX_CLIP_BYTES = 8 * 1024 * 1024;

let databasePromise;
let writesSincePrune = 0;

function database() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'key' });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }).catch(() => null);
  }
  return databasePromise;
}

export async function loadPreparedAudio(key) {
  const db = await database();
  if (!db) return null;
  return new Promise(resolve => {
    const request = db.transaction(STORE).objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result?.audio || null);
    request.onerror = () => resolve(null);
  });
}

export async function savePreparedAudio(key, audio) {
  if (!audio?.size || audio.size > MAX_CLIP_BYTES) return false;
  const db = await database();
  if (!db) return false;
  const saved = await new Promise(resolve => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).put({ key, audio, bytes: audio.size, used: Date.now() });
    transaction.oncomplete = () => resolve(true);
    transaction.onerror = () => resolve(false);
    transaction.onabort = () => resolve(false);
  });
  if (!saved) return false;
  writesSincePrune += 1;
  if (writesSincePrune < 20) return true;
  writesSincePrune = 0;
  const entries = await new Promise(resolve => {
    const request = db.transaction(STORE).objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve([]);
  });
  entries.sort((a, b) => b.used - a.used);
  let bytes = 0;
  const stale = entries.filter((entry, index) => {
    bytes += entry.bytes || entry.audio?.size || 0;
    return index >= MAX_ITEMS || bytes > MAX_BYTES;
  });
  if (stale.length) {
    const transaction = db.transaction(STORE, 'readwrite');
    stale.forEach(entry => transaction.objectStore(STORE).delete(entry.key));
  }
  return true;
}

export async function clearPreparedAudio() {
  const db = await database();
  if (!db) return;
  await new Promise(resolve => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.objectStore(STORE).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = resolve;
    transaction.onabort = resolve;
  });
  writesSincePrune = 0;
}
