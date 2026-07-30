/// <reference lib="webworker" />
/* eslint-disable */

const CACHE_NAME = 'almacen-v2.0.0';
const STATIC_CACHE = 'almacen-static-v2.0.0';
const DYNAMIC_CACHE = 'almacen-dynamic-v2.0.0';
const API_CACHE = 'almacen-api-v2.0.0';
const OFFLINE_URL = '/offline.html';

// Activos estaticos para cachear al instalar
const STATIC_ASSETS = [
  '/manifest.json',
  '/logo.svg',
  '/offline.html',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Rutas API para cachear con estrategia network-first
const API_ROUTES_TO_CACHE = [
  '/api/items',
  '/api/offices',
  '/api/users',
  '/api/warehouses',
  '/api/dashboard',
  '/api/config',
];

// Maximo de elementos en cache dinamico
const MAX_DYNAMIC_CACHE_SIZE = 50;

// Duracion del cache de API (en milisegundos)
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Evento install - cachear activos estaticos
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando service worker...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Cacheando activos estaticos');
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Evento activate - limpiar caches viejos y tomar control
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name !== STATIC_CACHE && 
                   name !== DYNAMIC_CACHE && 
                   name !== API_CACHE;
          })
          .map((name) => {
            console.log('[SW] Eliminando cache viejo:', name);
            return caches.delete(name);
          })
      );
    }).then(() => {
      console.log('[SW] Tomando control de clientes');
      return self.clients.claim();
    })
  );
});

// Manejador de eventos fetch
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Omitir solicitudes que no sean GET para cache
  if (request.method !== 'GET') {
    // Para POST/PUT/DELETE, intentar red y encolar para sync si esta offline
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      event.respondWith(handleMutationRequest(request));
    }
    return;
  }

  // Manejar solicitudes API con estrategia network-first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Manejar solicitudes de navegacion
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // Manejar activos estaticos con estrategia cache-first
  event.respondWith(handleStaticRequest(request));
});

// Manejar solicitudes de mutacion (POST, PUT, DELETE)
async function handleMutationRequest(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch (error) {
    // Encolar la solicitud para sync en segundo plano
    await queueRequestForSync(request);
    
    // Devolver respuesta indicando que la operacion esta pendiente
    return new Response(
      JSON.stringify({
        success: false,
        offline: true,
        message: 'Sin conexión. La operación se procesará cuando vuelva a estar en línea.',
        queuedAt: new Date().toISOString()
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Encolar solicitud para sync en segundo plano
async function queueRequestForSync(request) {
  const requestData = {
    id: Date.now(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body: await request.clone().text(),
    timestamp: new Date().toISOString()
  };

  // Almacenar en IndexedDB
  const db = await openOfflineDB();
  const tx = db.transaction('pendingRequests', 'readwrite');
  const store = tx.objectStore('pendingRequests');
  await store.add(requestData);
  
  // Registrar para sync en segundo plano
  if ('sync' in self.registration) {
    await self.registration.sync.register('sync-pending-requests');
  }
  
  // Notificar al cliente
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'REQUEST_QUEUED',
      data: requestData
    });
  });
}

// Manejar solicitudes API con estrategia network-first
async function handleApiRequest(request) {
  const url = new URL(request.url);
  
  // Verificar si esta ruta debe cachearse
  const shouldCache = API_ROUTES_TO_CACHE.some(route => 
    url.pathname.startsWith(route)
  );

  try {
    // Intentar red primero
    const networkResponse = await fetch(request);
    
    // Cachear respuestas exitosas
    if (networkResponse.ok && shouldCache) {
      const cache = await caches.open(API_CACHE);
      const responseToCache = networkResponse.clone();
      
      // Agregar timestamp para invalidacion de cache
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      cache.put(request, new Response(await responseToCache.blob(), {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      }));
    }
    
    return networkResponse;
  } catch (error) {
    // Intentar cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Verificar si el cache aun es valido
      const cacheTime = cachedResponse.headers.get('sw-cache-time');
      if (cacheTime) {
        const age = Date.now() - parseInt(cacheTime);
        if (age < API_CACHE_DURATION) {
          return cachedResponse;
        }
      } else {
        return cachedResponse;
      }
    }
    
    // Devolver respuesta offline
    return new Response(
      JSON.stringify({
        error: 'Sin conexión',
        offline: true,
        message: 'No se pueden obtener datos sin conexión. Intente más tarde.'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Manejar solicitudes de navegacion
async function handleNavigationRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cachear respuestas exitosas
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Intentar cache primero
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Devolver pagina offline
    return caches.match(OFFLINE_URL);
  }
}

// Manejar activos estaticos con estrategia cache-first
async function handleStaticRequest(request) {
  // Intentar cache primero
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // Actualizar cache en segundo plano (stale-while-revalidate)
    updateCacheInBackground(request);
    return cachedResponse;
  }
  
  // Intentar red
  try {
    const networkResponse = await fetch(request);
    
    // Cachear respuestas exitosas
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, networkResponse.clone());
      await trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_CACHE_SIZE);
    }
    
    return networkResponse;
  } catch (error) {
    // Devolver fallback offline para HTML
    if (request.headers.get('Accept')?.includes('text/html')) {
      return caches.match(OFFLINE_URL);
    }
    
    return new Response('Offline', { status: 503 });
  }
}

// Actualizar cache en segundo plano
async function updateCacheInBackground(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      await cache.put(request, networkResponse);
    }
  } catch (error) {
    // Fallar silenciosamente - ya tenemos version en cache
  }
}

// Recortar cache al tamano maximo
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  
  if (keys.length > maxItems) {
    // Eliminar entradas mas antiguas
    const itemsToDelete = keys.slice(0, keys.length - maxItems);
    await Promise.all(itemsToDelete.map(key => cache.delete(key)));
  }
}

// Abrir IndexedDB para almacenamiento offline
function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('almacen-offline', 2);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Almacen para solicitudes pendientes
      if (!db.objectStoreNames.contains('pendingRequests')) {
        const store = db.createObjectStore('pendingRequests', { 
          keyPath: 'id',
          autoIncrement: true 
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('url', 'url', { unique: false });
      }
      
      // Almacen para datos cacheados
      if (!db.objectStoreNames.contains('cachedData')) {
        const store = db.createObjectStore('cachedData', { 
          keyPath: 'key' 
        });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Almacen para estado de sync
      if (!db.objectStoreNames.contains('syncStatus')) {
        db.createObjectStore('syncStatus', { keyPath: 'id' });
      }
    };
  });
}

// Evento de sync en segundo plano
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync en segundo plano activado:', event.tag);
  
  if (event.tag === 'sync-pending-requests') {
    event.waitUntil(syncPendingRequests());
  }
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
  if (event.tag === 'sync-scans') {
    event.waitUntil(syncScans());
  }
  if (event.tag === 'sync-inventory') {
    event.waitUntil(syncInventory());
  }
});

// Sincronizar solicitudes pendientes
async function syncPendingRequests() {
  console.log('[SW] Sincronizando solicitudes pendientes...');
  
  const db = await openOfflineDB();
  const tx = db.transaction('pendingRequests', 'readwrite');
  const store = tx.objectStore('pendingRequests');
  const requests = await store.getAll();
  
  const results = [];
  
  for (const requestData of requests) {
    try {
      const response = await fetch(requestData.url, {
        method: requestData.method,
        headers: requestData.headers,
        body: requestData.body
      });
      
      if (response.ok) {
        // Eliminar de la cola al tener exito
        await store.delete(requestData.id);
        results.push({ id: requestData.id, success: true });
        
        // Notificar al cliente
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
          client.postMessage({
            type: 'REQUEST_SYNCED',
            data: { id: requestData.id, success: true }
          });
        });
      } else {
        results.push({ 
          id: requestData.id, 
          success: false, 
          error: `HTTP ${response.status}` 
        });
      }
    } catch (error) {
      results.push({ 
        id: requestData.id, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  return results;
}

// Sincronizar pedidos
async function syncOrders() {
  console.log('[SW] Sincronizando pedidos...');
  // Se ejecuta cuando el sync en segundo plano se activa para pedidos
  // La implementacion real usara datos de IndexedDB
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'ORDERS_SYNC_START'
    });
  });
  
  // Iniciar el proceso de sync
  await syncPendingRequests();
}

// Sincronizar escaneos
async function syncScans() {
  console.log('[SW] Sincronizando escaneos...');
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SCANS_SYNC_START'
    });
  });
  
  await syncPendingRequests();
}

// Sincronizar inventario
async function syncInventory() {
  console.log('[SW] Sincronizando inventario...');
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'INVENTORY_SYNC_START'
    });
  });
  
  await syncPendingRequests();
}

// Evento de notificacion push
self.addEventListener('push', (event) => {
  console.log('[SW] Notificacion push recibida');
  
  const data = event.data?.json() ?? {};
  const title = data.title || 'Sistema de Almacén';
  const options = {
    body: data.body || 'Nueva notificación',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    image: data.image,
    data: {
      url: data.url || '/',
      id: data.id,
      type: data.type
    },
    actions: data.actions || [
      { action: 'view', title: 'Ver' },
      { action: 'dismiss', title: 'Descartar' }
    ],
    tag: data.tag || 'general',
    requireInteraction: data.requireInteraction || false,
    silent: data.silent || false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Manejador de clic en notificacion
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificacion cliqueada');
  event.notification.close();
  
  const action = event.action;
  const data = event.notification.data || {};
  
  if (action === 'dismiss') {
    return;
  }
  
  const url = data.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Verificar si ya hay una ventana abierta
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICKED',
              data
            });
            return client.focus();
          }
        }
        // Abrir nueva ventana si no existe ninguna
        return self.clients.openWindow(url);
      })
  );
});

// Manejador de cierre de notificacion
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notificacion cerrada');
  // Puede usarse para analitica
});

// Manejador de mensajes para comunicacion con la app principal
self.addEventListener('message', (event) => {
  console.log('[SW] Mensaje recibido:', event.data);
  
  const { type, data } = event.data || {};
  
  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CACHE_URLS':
      event.waitUntil(
        caches.open(DYNAMIC_CACHE).then(cache => cache.addAll(data.urls))
      );
      break;
      
    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then(cacheNames => {
          return Promise.all(
            cacheNames.map(name => caches.delete(name))
          );
        })
      );
      break;
      
    case 'GET_PENDING_COUNT':
      event.waitUntil(
        openOfflineDB().then(db => {
          const tx = db.transaction('pendingRequests', 'readonly');
          const store = tx.objectStore('pendingRequests');
          return store.count();
        }).then(count => {
          event.ports[0]?.postMessage({ count });
        })
      );
      break;
      
    case 'TRIGGER_SYNC':
      if ('sync' in self.registration) {
        event.waitUntil(
          self.registration.sync.register('sync-pending-requests')
        );
      }
      break;
      
    case 'CACHE_DATA':
      event.waitUntil(
        openOfflineDB().then(db => {
          const tx = db.transaction('cachedData', 'readwrite');
          const store = tx.objectStore('cachedData');
          return store.put({
            key: data.key,
            value: data.value,
            timestamp: Date.now()
          });
        })
      );
      break;
      
    case 'GET_CACHED_DATA':
      event.waitUntil(
        openOfflineDB().then(db => {
          const tx = db.transaction('cachedData', 'readonly');
          const store = tx.objectStore('cachedData');
          return store.get(data.key);
        }).then(result => {
          event.ports[0]?.postMessage(result);
        })
      );
      break;
  }
});

// Sync periodico en segundo plano (si es soportado)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Sync periodico activado:', event.tag);
  
  if (event.tag === 'sync-all') {
    event.waitUntil(syncPendingRequests());
  }
});

console.log('[SW] Service worker cargado');
