/**
 * Servicio de Sincronización
 * Maneja la sincronización de datos offline con el servidor
 */

import {
  getPendingRequests,
  updatePendingRequest,
  removePendingRequest,
  updateSyncStatus,
  type PendingRequest,
} from './offline-storage';

const MAX_RETRIES = 3;
const SYNC_BATCH_SIZE = 10;

let isSyncing = false;

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: Array<{ id: number; error: string }>;
}

export interface SyncEventDetail {
  type: 'sync-start' | 'sync-end' | 'sync-error';
  result?: SyncResult;
  error?: string;
}

function dispatchSyncEvent(detail: SyncEventDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<SyncEventDetail>('sync-event', { detail }));
}

function isOnline(): boolean {
  if (typeof navigator === 'undefined') return true;
  return navigator.onLine;
}

async function getOfflineRequests(): Promise<PendingRequest[]> {
  try {
    const requests = await getPendingRequests();
    return requests.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch {
    return [];
  }
}

async function processSyncQueue(): Promise<SyncResult> {
  if (isSyncing) return { success: false, synced: 0, failed: 0, errors: [{ id: -1, error: 'Sincronización ya en progreso' }] }
  isSyncing = true
  try {
    const result: SyncResult = { success: true, synced: 0, failed: 0, errors: [] };

    if (!isOnline()) {
      result.success = false;
      return result;
    }

    dispatchSyncEvent({ type: 'sync-start' });

    try {
      const requests = await getOfflineRequests();
      const batch = requests.slice(0, SYNC_BATCH_SIZE);

      for (const req of batch) {
        try {
          const fetchOptions: RequestInit = {
            method: req.method,
            headers: {
              'Content-Type': 'application/json',
              ...req.headers,
            },
          };

          if (req.body && req.method !== 'GET') {
            fetchOptions.body = req.body;
          }

          const response = await fetch(req.url, fetchOptions);

          if (response.ok || response.status === 409) {
            if (req.id !== undefined) {
              await removePendingRequest(req.id);
            }
            result.synced++;
          } else {
            const retryCount = (req.retryCount || 0) + 1;
            if (retryCount >= MAX_RETRIES) {
              if (req.id !== undefined) {
                await removePendingRequest(req.id);
              }
              result.failed++;
              result.errors.push({ id: req.id!, error: `HTTP ${response.status}: ${response.statusText}` });
            } else {
              await updatePendingRequest({ ...req, retryCount, lastError: `HTTP ${response.status}` });
            }
          }
        } catch (error) {
          if (req.id !== undefined) {
            await removePendingRequest(req.id);
          }
          result.failed++;
          result.errors.push({ id: req.id!, error: error instanceof Error ? error.message : 'Error desconocido' });
        }
      }

      await updateSyncStatus({
        id: 'last-sync',
        lastSync: new Date().toISOString(),
        status: result.failed > 0 ? (result.synced > 0 ? 'partial' : 'failed') : 'success',
        recordsSynced: result.synced,
        recordsFailed: result.failed,
      });

      if (result.failed > 0) {
        result.success = false;
      }
    } catch (error) {
      result.success = false;
      result.errors.push({ id: -1, error: error instanceof Error ? error.message : 'Error de sincronización' });
    }

    dispatchSyncEvent({ type: 'sync-end', result });
    return result;
  } finally {
    isSyncing = false;
  }
}

// Inicializar detector de conectividad y sincronización automática
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

export function initSyncService(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    processSyncQueue().catch(error => {
      console.error('[SYNC] Error en sync por conexión:', error)
    })
  });

  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  syncIntervalId = setInterval(async () => {
    if (!isOnline()) return
    const pending = await getOfflineRequests().catch(() => [])
    if (pending.length === 0) return
    processSyncQueue().catch(error => {
      console.error('[SYNC] Error en sync programado:', error)
    })
  }, 30000);

  if (isOnline()) {
    processSyncQueue().catch(error => {
      console.error('[SYNC] Error en sync inicial:', error)
    })
  }
}


