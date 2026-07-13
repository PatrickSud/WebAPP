// ============================================
// Service Worker — Cache Strategy & Versioning
// ============================================

const CACHE_NAME = 'ministerio-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

const NOTIFICATION_CACHE_NAME = 'ministerio-notifications-v1';
const NOTIFICATION_CACHE_KEY = 'https://local-notification-schedule.json';

// Helper to get notifications from Cache Storage
async function getStoredNotifications() {
  try {
    const cache = await caches.open(NOTIFICATION_CACHE_NAME);
    const response = await cache.match(NOTIFICATION_CACHE_KEY);
    if (response) {
      return await response.json();
    }
  } catch (e) {
    console.error('[SW] Error reading notification cache:', e);
  }
  return [];
}

// Helper to save notifications to Cache Storage
async function saveNotifications(notifications) {
  try {
    const cache = await caches.open(NOTIFICATION_CACHE_NAME);
    await cache.put(
      NOTIFICATION_CACHE_KEY,
      new Response(JSON.stringify(notifications), {
        headers: { 'Content-Type': 'application/json' }
      })
    );
  } catch (e) {
    console.error('[SW] Error writing notification cache:', e);
  }
}

// Helper to check and show pending notifications
async function checkAndShowNotifications() {
  const now = Date.now();
  const list = await getStoredNotifications();
  let updated = false;

  for (const notification of list) {
    // If it's time to send it, and it hasn't been sent yet
    if (notification.scheduledFor <= now && !notification.sent) {
      notification.sent = true;
      updated = true;

      // Show notification
      const title = 'Lembrete de Ministração 🔔';
      const options = {
        body: notification.message || 'Lembrete de contato com pessoa ausente.',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        vibrate: [100, 50, 100],
        data: {
          id: notification.id,
          type: notification.type,
          url: '/home'
        }
      };

      // Try to register native notification triggers if supported
      if (typeof TimestampTrigger !== 'undefined') {
        options.showTrigger = new TimestampTrigger(notification.scheduledFor);
      }

      // Ensure notification permission is granted before showing
      if (self.Notification && self.Notification.permission === 'granted') {
        try {
          await self.registration.showNotification(title, options);
          console.log('[SW] Showed scheduled notification:', notification.id);
        } catch (err) {
          console.error('[SW] Failed to show notification:', err);
        }
      }
    }
  }

  if (updated) {
    await saveNotifications(list);
  }
}

// Install: pre-cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Don't wait for old SW to finish
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    Promise.all([
      caches.keys().then((names) => {
        return Promise.all(
          names
            .filter((name) => name !== CACHE_NAME && name !== NOTIFICATION_CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      }),
      checkAndShowNotifications()
    ])
  );
  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch: network-first for navigations, cache-first for assets
self.addEventListener('fetch', (event) => {
  // Check and show notifications as a heartbeat on fetch
  event.waitUntil(checkAndShowNotifications());

  const isLocalhost = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isLocalhost) return;

  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip cross-origin requests (Firebase, APIs, etc.)
  if (url.origin !== self.location.origin) return;

  // Navigation requests: network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache the latest version
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
          return response;
        })
        .catch(() => {
          // Offline: try cache
          return caches.match(request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      return fetch(request).then((response) => {
        // Only cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      });
    })
  );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting triggered');
    self.skipWaiting();
  }

  if (event.data.type === 'SCHEDULE_NOTIFICATIONS') {
    event.waitUntil(
      (async () => {
        const notifications = event.data.notifications || [];
        await saveNotifications(notifications);
        console.log('[SW] Scheduled notifications updated:', notifications.length);
        await checkAndShowNotifications();
      })()
    );
  }

  if (event.data.type === 'CANCEL_NOTIFICATION') {
    event.waitUntil(
      (async () => {
        const idToCancel = event.data.id;
        const list = await getStoredNotifications();
        const updated = list.map(n => n.id === idToCancel ? { ...n, sent: true } : n);
        await saveNotifications(updated);
        console.log('[SW] Cancelled notification:', idToCancel);
      })()
    );
  }

  if (event.data.type === 'CLEAR_NOTIFICATIONS') {
    event.waitUntil(
      (async () => {
        await saveNotifications([]);
        console.log('[SW] Cleared all scheduled notifications');
      })()
    );
  }
});

// Handle notification click: focus or open window
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = (event.notification.data && event.notification.data.url) || '/home';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});

