const CACHE_NAME = 'universe-os-core-v1';

// インストール時にキャッシュを初期化
self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('[OS System] Service Worker Installed.');
});

// 古いキャッシュのパージ（更新用）
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[OS System] Old Cache Purged.');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    event.waitUntil(clients.claim());
});

// オフライン・プロキシ（ネットワークが切れていてもアプリを起動させる）
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // 動的にキャッシュに保存（※APIや外部通信は除く）
                if (event.request.url.startsWith(self.location.origin)) {
                    const clonedResponse = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // 完全オフライン時のフォールバック
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});