/**
 * Utilidad de Almacenamiento Offline
 * Proporciona almacenamiento basado en IndexedDB para persistencia de datos offline
 */

const DB_NAME = 'almacen-offline';
const DB_VERSION = 2;

const STORES = {
  PENDING_REQUESTS: 'pendingRequests',
  CACHED_DATA: 'cachedData',
  SYNC_STATUS: 'syncStatus',
  OFFLINE_ITEMS: 'offlineItems',
  OFFICE_DATA: 'offlineOffices',
  USER_DATA: 'offlineUsers',
} as const;

export interface PendingRequest {
  id?: number;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: string;
  retryCount?: number;
  lastError?: string;
}

export interface SyncStatus {
  id: string;
  lastSync: string;
  status: 'success' | 'failed' | 'pending' | 'partial';
  error?: string;
  recordsSynced?: number;
  recordsFailed?: number;
}

let dbInstance: IDBDatabase | null = null;

async function openDatabase(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error al abrir base de datos offline:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.PENDING_REQUESTS)) {
        const store = db.createObjectStore(STORES.PENDING_REQUESTS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('url', 'url', { unique: false });
        store.createIndex('method', 'method', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.CACHED_DATA)) {
        const store = db.createObjectStore(STORES.CACHED_DATA, {
          keyPath: 'key',
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SYNC_STATUS)) {
        db.createObjectStore(STORES.SYNC_STATUS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.OFFLINE_ITEMS)) {
        const store = db.createObjectStore(STORES.OFFLINE_ITEMS, {
          keyPath: 'id',
        });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
        store.createIndex('dirty', 'dirty', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.OFFICE_DATA)) {
        const store = db.createObjectStore(STORES.OFFICE_DATA, {
          keyPath: 'id',
        });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
        const store = db.createObjectStore(STORES.USER_DATA, {
          keyPath: 'id',
        });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });
}

async function getStore(
  storeName: string,
  mode: IDBTransactionMode = 'readonly'
): Promise<IDBObjectStore> {
  const db = await openDatabase();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

export async function getPendingRequests(): Promise<PendingRequest[]> {
  const store = await getStore(STORES.PENDING_REQUESTS);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function updatePendingRequest(request: PendingRequest): Promise<void> {
  const store = await getStore(STORES.PENDING_REQUESTS, 'readwrite');

  return new Promise((resolve, reject) => {
    const req = store.put(request);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function removePendingRequest(id: number): Promise<void> {
  const store = await getStore(STORES.PENDING_REQUESTS, 'readwrite');

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function updateSyncStatus(status: SyncStatus): Promise<void> {
  const store = await getStore(STORES.SYNC_STATUS, 'readwrite');

  return new Promise((resolve, reject) => {
    const request = store.put(status);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
