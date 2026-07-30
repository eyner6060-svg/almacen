'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export interface PendingOperation {
  id: number;
  url: string;
  method: string;
  body?: string;
  timestamp: string;
  type: 'order' | 'scan' | 'item' | 'other';
}

export interface OfflineStatus {
  isOnline: boolean;
  isOffline: boolean;
  lastOnlineTime: Date | null;
  lastOfflineTime: Date | null;
}

export interface UseOfflineReturn {
  // Estado
  isOnline: boolean;
  isOffline: boolean;
  lastOnlineTime: Date | null;
  lastOfflineTime: Date | null;
  
  // Operaciones pendientes
  pendingOperations: PendingOperation[];
  pendingCount: number;
  
  // Acciones
  syncNow: () => Promise<void>;
  clearPending: () => Promise<void>;
  removePendingOperation: (id: number) => Promise<void>;
  
  // Auxiliares
  queueOperation: (operation: Omit<PendingOperation, 'id' | 'timestamp'>) => Promise<void>;
}

// Auxiliar para abrir IndexedDB
function openOfflineDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('almacen-offline', 2);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      if (!db.objectStoreNames.contains('pendingRequests')) {
        const store = db.createObjectStore('pendingRequests', {
          keyPath: 'id',
          autoIncrement: true,
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('url', 'url', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('cachedData')) {
        const store = db.createObjectStore('cachedData', { keyPath: 'key' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

// Auxiliar para determinar el tipo de operación
function getOperationType(url: string): PendingOperation['type'] {
  if (url.includes('/api/orders')) return 'order';
  if (url.includes('/api/traceability') || url.includes('/scan')) return 'scan';
  if (url.includes('/api/items')) return 'item';
  return 'other';
}

// Auxiliar para cargar operaciones pendientes desde IndexedDB
async function loadPendingOpsFromDB(): Promise<PendingOperation[]> {
  if (typeof indexedDB === 'undefined') return [];
  
  try {
    const db = await openOfflineDB();
    const tx = db.transaction('pendingRequests', 'readonly');
    const store = tx.objectStore('pendingRequests');
    const requests = await new Promise<PendingOperation[]>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    
    return requests.map((req: PendingOperation) => ({
      id: req.id,
      url: req.url,
      method: req.method,
      body: req.body,
      timestamp: req.timestamp,
      type: getOperationType(req.url),
    }));
  } catch (error) {
    console.error('Error al cargar operaciones pendientes:', error);
    return [];
  }
}

// Auxiliar para eliminar operación pendiente de IndexedDB
async function removePendingOpFromDB(id: number): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  
  const db = await openOfflineDB();
  const tx = db.transaction('pendingRequests', 'readwrite');
  const store = tx.objectStore('pendingRequests');
  await new Promise<void>((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Auxiliar para limpiar todas las operaciones pendientes de IndexedDB
async function clearPendingOpsFromDB(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  
  const db = await openOfflineDB();
  const tx = db.transaction('pendingRequests', 'readwrite');
  const store = tx.objectStore('pendingRequests');
  await new Promise<void>((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export function useOffline(): UseOfflineReturn {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    isOffline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
    lastOnlineTime: null,
    lastOfflineTime: null,
  });
  
  const [pendingOperations, setPendingOperations] = useState<PendingOperation[]>([]);
  const pendingOpsRef = useRef<PendingOperation[]>([]);
  
  // Mantener ref sincronizada con el estado
  useEffect(() => {
    pendingOpsRef.current = pendingOperations;
  }, [pendingOperations]);
  
  // Eliminar una operación pendiente específica
  const removePendingOperation = useCallback(async (id: number) => {
    await removePendingOpFromDB(id);
    setPendingOperations(prev => prev.filter(op => op.id !== id));
  }, []);
  
  // Sincronización manual de respaldo
  const manualSync = useCallback(async () => {
    const operations = pendingOpsRef.current;
    
    for (const op of operations) {
      try {
        const response = await fetch(op.url, {
          method: op.method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: op.body,
        });
        
        if (response.ok) {
          await removePendingOpFromDB(op.id);
          setPendingOperations(prev => prev.filter(p => p.id !== op.id));
        }
      } catch (error) {
        console.error('Error al sincronizar operación:', op.id, error);
      }
    }
  }, []);
  
  // Sincronizar ahora - activar sincronización en segundo plano
  const syncNow = useCallback(async () => {
    if (!navigator.onLine) {
      return;
    }
    
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-pending-requests');
      } catch (error) {
        console.error('Error al registrar sincronización en segundo plano:', error);
        await manualSync();
      }
    } else {
      await manualSync();
    }
    
    // Recargar operaciones pendientes
    const ops = await loadPendingOpsFromDB();
    setPendingOperations(ops);
  }, [manualSync]);
  
  // Limpiar todas las operaciones pendientes
  const clearPending = useCallback(async () => {
    await clearPendingOpsFromDB();
    setPendingOperations([]);
  }, []);
  
  // Poner en cola una nueva operación
  const queueOperation = useCallback(async (operation: Omit<PendingOperation, 'id' | 'timestamp'>) => {
    if (typeof indexedDB === 'undefined') return;
    
    try {
      const db = await openOfflineDB();
      const tx = db.transaction('pendingRequests', 'readwrite');
      const store = tx.objectStore('pendingRequests');
      
      const newOperation = {
        ...operation,
        timestamp: new Date().toISOString(),
      };
      
      const id = await new Promise<number>((resolve, reject) => {
        const request = store.add(newOperation);
        request.onsuccess = () => resolve(request.result as number);
        request.onerror = () => reject(request.error);
      });
      
      setPendingOperations(prev => [
        ...prev,
        { ...newOperation, id },
      ]);
      
      // Registrar para sincronización en segundo plano si es compatible
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        await (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-pending-requests');
      }
    } catch (error) {
      console.error('Error al encolar operación:', error);
    }
  }, []);
  
  // Manejar eventos en línea/fuera de línea
  useEffect(() => {
    let isMounted = true;
    
    const handleOnline = async () => {
      setStatus(prev => ({
        isOnline: true,
        isOffline: false,
        lastOnlineTime: new Date(),
        lastOfflineTime: prev.lastOfflineTime,
      }));
      
      // Activar sincronización al volver a estar en línea
      if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
                  await (registration as unknown as { sync: { register: (tag: string) => Promise<void> } }).sync.register('sync-pending-requests');
        } catch (error) {
        console.error('Error al registrar sincronización en segundo plano:', error);
        }
      }
    };
    
    const handleOffline = () => {
      setStatus(prev => ({
        isOnline: false,
        isOffline: true,
        lastOnlineTime: prev.lastOnlineTime,
        lastOfflineTime: new Date(),
      }));
    };
    
    const handleRequestQueued = async () => {
      if (isMounted) {
        const ops = await loadPendingOpsFromDB();
        if (isMounted) {
          setPendingOperations(ops);
        }
      }
    };
    
    const handleRequestSynced = async () => {
      if (isMounted) {
        const ops = await loadPendingOpsFromDB();
        if (isMounted) {
          setPendingOperations(ops);
        }
      }
    };
    
    // Escuchar eventos en línea/fuera de línea
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Escuchar eventos personalizados del service worker
    window.addEventListener('offlineRequestQueued', handleRequestQueued as EventListener);
    window.addEventListener('offlineRequestSynced', handleRequestSynced as EventListener);
    
    // Carga inicial - usar IIFE asíncrona
    (async () => {
      const ops = await loadPendingOpsFromDB();
      if (isMounted) {
        setPendingOperations(ops);
      }
    })();
    
    return () => {
      isMounted = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offlineRequestQueued', handleRequestQueued as EventListener);
      window.removeEventListener('offlineRequestSynced', handleRequestSynced as EventListener);
    };
  }, []);
  
  return {
    isOnline: status.isOnline,
    isOffline: status.isOffline,
    lastOnlineTime: status.lastOnlineTime,
    lastOfflineTime: status.lastOfflineTime,
    pendingOperations,
    pendingCount: pendingOperations.length,
    syncNow,
    clearPending,
    removePendingOperation,
    queueOperation,
  };
}

export default useOffline;
