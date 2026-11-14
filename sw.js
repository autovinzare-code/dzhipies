/* Офлайн-режим go-transfer-go.
   Файлы приложения хранятся в кэше телефона, поэтому оно открывается и без интернета.
   После изменения index.html или других файлов увеличьте VERSION, чтобы у людей скачалась новая версия. */
const VERSION = "v1";
const APP = "gtg-app-" + VERSION;
const LIBS = "gtg-libs-" + VERSION;

const APP_FILES = [
  "./",
  "index.html",
  "eumap.js",
  "euroads.js",
  "eucities.js",
  "manifest.webmanifest",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/apple-touch-icon.png",
  "icons/favicon-32.png"
];

/* Сторонние файлы, которые можно хранить: библиотеки и шрифты.
   Поиск адресов, маршруты, вход и база данных всегда идут в сеть и не кэшируются. */
const LIB_HOSTS = ["cdnjs.cloudflare.com", "unpkg.com", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(APP_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("gtg-") && k !== APP && k !== LIBS).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Страница приложения: сначала сеть (свежая версия), без сети — из кэша.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => { if (res.ok) { const copy = res.clone(); caches.open(APP).then(c => c.put("index.html", copy)); } return res; })
        .catch(() => caches.match("index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  // Свои файлы: сразу из кэша, а в фоне обновляем.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.open(APP).then(c => c.match(req, { ignoreSearch: true }).then(hit => {
        const net = fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
    return;
  }

  // Библиотеки и шрифты: из кэша, если уже скачаны.
  if (LIB_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.open(LIBS).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok || res.type === "opaque") c.put(req, res.clone());
        return res;
      })))
    );
  }
  // Всё остальное (карта, поиск, маршруты, сервер) браузер берёт из сети как обычно.
});
