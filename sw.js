const CACHE_NAME = 'universe-os-core-v2';

self.addEventListener('install', (event) => {
    self.skipWaiting();
    console.log('[OS System] Service Worker Installed (v2).');
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // http/httpsリクエスト以外（拡張機能など）は無視する
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            return fetch(event.request).then((networkResponse) => {
                // 正常なGETリクエスト、かつ自分自身のドメインのファイルのみをキャッシュする
                if (event.request.method === 'GET' && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
                    const clonedResponse = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                }
                return networkResponse;
            }).catch(() => {
                // オフライン時のフォールバック処理
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
                // エラーでシステムが止まらないように、空のレスポンスを返す（パニック回避）
                return new Response('', { status: 408, statusText: 'Offline' });
            });
        })
    );
});