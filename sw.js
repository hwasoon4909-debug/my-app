// 파일을 고칠 때마다 VERSION 숫자를 올려 주세요.
const VERSION = 'v7';
const PREFIX = 'my-app-water-';
const CACHE = PREFIX + VERSION;
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)));
  self.skipWaiting(); // 기다리지 않고 바로 적용
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      // 같은 주소의 다른 앱 캐시는 건드리지 않고, 이 앱의 옛 캐시만 지워요
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 인터넷이 되면 새 파일 먼저(network-first), 안 되면 저장해 둔 파일
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req, { cache: 'no-store' })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((hit) => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
      )
  );
});
