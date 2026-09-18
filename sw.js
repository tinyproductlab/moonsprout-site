/* 月芽故事岛 Service Worker：离线缓存应用外壳与绘本资源 */
var CACHE = 'ms-reader-v2';
var SHELL = ['/', '/reader', '/index.html', '/reader.html', '/book.html', '/assets/icon.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // 外壳资源失败也继续（避免首次安装卡住）
      return c.addAll(SHELL).catch(function () {});
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

// 运行时缓存：绘本资源（r2 / tts 结果）缓存不通过，获取失败再落缓存；同源页面走缓存优先
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // 非 GET 一律放行
  if (e.request.method !== 'GET') return;

  // 对外部 TTS/云资源不拦截，浏览器正常请求
  if (url.origin !== self.location.origin) return;

  // 页面/外壳：网络优先，离线回退缓存
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
          return res;
        })
        .catch(function () {
          return caches.match(e.request).then(function (m) {
            return m || caches.match('/reader');
          });
        })
    );
    return;
  }

  // 其余同源资源：缓存优先，未命中则网络并写入缓存
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;
      return fetch(e.request).then(function (res) {
        if (res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      });
    }).catch(function () { return e.request; })
  );
});