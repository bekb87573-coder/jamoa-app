/* Jamoa — кэш для быстрого повторного входа (волна 3, Д1).
   Стратегия: сначала из кэша, в фоне — проверка новой версии с сервера.
   Версия кэша — window.JAMOA_VERSION из product.js. Новая версия product.js → новый воркер ждёт,
   приложение показывает строку «Есть обновление — Обновить» и переключается только по нажатию. */
self.window = self;
try { importScripts('product.js'); } catch (e) {}
var VER = 'jamoa-' + (self.JAMOA_VERSION || '1');
var CORE = ['app.html', 'product.js', 'i18n.js', 'saas-uz.js', 'icon.svg'];

self.addEventListener('install', function (e) {
  self.skipWaiting(); /* новая версия включается сразу, без кнопки «Обновить» */
  e.waitUntil(caches.open(VER).then(function (c) { return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); })); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('jamoa-') === 0 && k !== VER; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('message', function (e) { if (e.data && e.data.type === 'skip') self.skipWaiting(); });

function cacheable(req) {
  if (req.method !== 'GET') return false;
  var u = new URL(req.url);
  if (u.origin !== self.location.origin) return /fonts\.(gstatic|googleapis)\.com$/.test(u.hostname);
  return /\.(html|js|svg|woff2|png|webp|jpg|css)$/.test(u.pathname) || u.pathname.slice(-1) === '/';
}
self.addEventListener('fetch', function (e) {
  var req = e.request; if (!cacheable(req)) return;
  var key = req.mode === 'navigate' ? new Request(new URL(req.url).pathname.replace(/\/$/, '/index.html')) : req;
  /* сначала сеть (всегда свежая версия), кэш — только если сети нет */
  e.respondWith(caches.open(VER).then(function (c) {
    return fetch(req, { cache: 'no-cache' }).then(function (r) { if (r && r.ok) c.put(key, r.clone()); return r; })
      .catch(function () { return c.match(key, { ignoreSearch: true }); });
  }));
});

/* уведомления: нажатие открывает приложение на списке уведомлений */
self.addEventListener('push', function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || self.PRODUCT_NAME || '', { body: d.body || '', icon: 'icon.svg', data: d }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (l) {
    if (l.length) { l[0].focus(); l[0].postMessage({ type: 'open-notif' }); return; }
    return self.clients.openWindow('app.html#notif');
  }));
});
