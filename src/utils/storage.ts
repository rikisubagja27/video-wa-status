import type {AppSettings, HistoryItem} from '../types/video';

const DB_NAME = 'wa-status-hd-pro-db';
const DB_VERSION = 1;
const HISTORY_STORE = 'history';
const TEMP_STORE = 'temp_workspace';
const SETTINGS_KEY = 'wa_status_hd_pro_settings_v1';

export const DEFAULT_APP_SETTINGS: AppSettings = {
  saveHistory: true,
  autoCleanTemp: true,
  defaultCodec: 'h264',
  defaultBitrate: 'wa-3200k',
};

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_APP_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      saveHistory: typeof parsed.saveHistory === 'boolean' ? parsed.saveHistory : DEFAULT_APP_SETTINGS.saveHistory,
      autoCleanTemp: typeof parsed.autoCleanTemp === 'boolean' ? parsed.autoCleanTemp : DEFAULT_APP_SETTINGS.autoCleanTemp,
      defaultCodec: parsed.defaultCodec === 'h265' ? 'h265' : 'h264',
      defaultBitrate:
        parsed.defaultBitrate &&
        ['wa-1200k', 'wa-2200k', 'wa-3200k', 'wa-auto', 'auto-hd', '6m', '8m', '12m'].includes(
          parsed.defaultBitrate,
        )
          ? parsed.defaultBitrate
          : 'wa-3200k',
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota issues on private browsing
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB tidak tersedia di browser ini.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(HISTORY_STORE)) {
        const store = db.createObjectStore(HISTORY_STORE, {keyPath: 'id'});
        store.createIndex('createdAt', 'createdAt', {unique: false});
      }
      if (!db.objectStoreNames.contains(TEMP_STORE)) {
        db.createObjectStore(TEMP_STORE, {keyPath: 'id'});
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Gagal membuka IndexedDB.'));
  });
}

export async function getHistoryItems(): Promise<HistoryItem[]> {
  try {
    const db = await openDB();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(HISTORY_STORE, 'readonly');
      const store = tx.objectStore(HISTORY_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result as HistoryItem[]) ?? [];
        items.sort((a, b) => b.createdAt - a.createdAt);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return [];
  }
}

export async function addHistoryItem(item: HistoryItem): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).put(item);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function deleteHistoryItem(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function clearAllHistory(): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.objectStore(HISTORY_STORE).clear();
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

export async function clearTempWorkspace(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(TEMP_STORE, 'readwrite');
      tx.objectStore(TEMP_STORE).clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignore if unavailable
  }
}
