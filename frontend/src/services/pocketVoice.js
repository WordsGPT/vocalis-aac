const DB_NAME = 'vocalis_pocket_voice';
const STORE = 'samples';

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact(mode, action) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, mode);
      const request = action(transaction.objectStore(STORE));
      let value;
      request.onsuccess = () => { value = request.result; };
      transaction.oncomplete = () => resolve(value);
      transaction.onerror = () => reject(transaction.error || request.error);
      transaction.onabort = () => reject(transaction.error || new Error('No se pudo guardar la voz.'));
    });
  } finally { db.close(); }
}

export const loadPocketVoice = () => transact('readonly', store => store.get('voice'));
export const savePocketVoice = blob => transact('readwrite', store => store.put(blob, 'voice'));
export const clearPocketVoice = () => transact('readwrite', store => store.delete('voice'));
