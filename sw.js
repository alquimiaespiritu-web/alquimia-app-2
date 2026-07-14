/* Alquimia — Service Worker
   1) Hace la web INSTALABLE como app.
   2) Recibe NOTIFICACIONES push y las muestra.
   Estrategia de caché: "network-first" (siempre intenta la versión nueva de internet;
   solo usa la copia guardada si no hay conexión). Así, cuando Mónica publica cambios,
   se ven de inmediato — nunca se queda pegada una versión vieja. */

const VERSION = 'alquimia-v1';
const CORE = [
  './',
  'index.html',
  'assets/styles.css',
  'assets/app.js',
  'assets/i18n.js',
  'assets/data.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(CORE).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// network-first: intenta la red; si falla (sin conexión), usa la caché.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Solo gestionamos peticiones del mismo sitio; lo externo (Supabase, Pexels, fuentes) va directo.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || caches.match('index.html'))
      )
  );
});

// ---- NOTIFICACIONES PUSH ----
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {
    data = { title: 'Alquimia', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Alquimia';
  const options = {
    body: data.body || '',
    icon: data.icon || 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    image: data.image || undefined,
    lang: data.lang || 'es',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    requireInteraction: false,
    data: { url: data.url || 'index.html' },
    vibrate: [80, 40, 80]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Al tocar la notificación: abre (o enfoca) la página indicada.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || 'index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
