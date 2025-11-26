// Nome do cache
const CACHE_NAME = 'expo2025-cache-v3';
const RUNTIME_CACHE = 'expo2025-runtime-v3';
const IMAGE_CACHE = 'expo2025-images-v3';

// Recursos essenciais para cache
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/images/icon.png',
  '/favicon.ico',
  '/offline.html',
];

// Estratégia: Cache First, fallback para Network
const cacheFirst = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
};

// Estratégia: Network First, fallback para Cache
const networkFirst = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    // Se for uma requisição de navegação e não temos cache, mostrar página offline
    if (request.mode === 'navigate') {
      const offlinePage = await cache.match('/offline.html');
      if (offlinePage) {
        return offlinePage;
      }
    }

    throw error;
  }
};

// Estratégia para imagens
const cacheImages = async (request) => {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }
  try {
    const response = await fetch(request);
    if (response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('Image fetch failed:', error);
    throw error;
  }
};

// Install event
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching essential files');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE && name !== IMAGE_CACHE)
            .map((name) => {
              console.log('Service Worker: Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requisições não HTTP/HTTPS
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Ignorar requisições para APIs externas (Supabase)
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request));
    return;
  }

  // Cache para imagens
  if (request.destination === 'image') {
    event.respondWith(cacheImages(request));
    return;
  }

  // Cache para assets estáticos (JS, CSS)
  if (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'font'
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Network First para páginas HTML e API calls
  if (request.destination === 'document' || request.method === 'GET') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Padrão: apenas fetch
  event.respondWith(fetch(request));
});

// Background sync (se suportado)
self.addEventListener('sync', (event) => {
  console.log('Service Worker: Background sync', event.tag);
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

async function syncOrders() {
  // Implementar lógica de sincronização de pedidos offline
  console.log('Service Worker: Syncing orders...');
} 