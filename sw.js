// バージョンを v3 に上げることで、ユーザーのスマホの古いキャッシュを強制破棄させます
const CACHE_NAME = 'universe-os-core-v3';

self.addEventListener('install', (event) => {
    // 新しいバージョンが来たら即座にインストール
    self.skipWaiting();
    console.log('[OS System] Service Worker Installed (v3).');
});

self.addEventListener('activate', (event) => {
    // 古いバージョンのキャッシュ（v2など）を自動的に消去
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[OS System] 古い宇宙の残骸を消去:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    // 即座に新しいサービスワーカーがコントロールを奪う
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // http/httpsリクエスト以外（拡張機能など）は無視する
    if (!event.request.url.startsWith('http')) return;

    // ★ 修正：【ネットワーク優先戦略】に変更
    // まずインターネットから最新のファイルを取りに行く
    event.respondWith(
        fetch(event.request).then((networkResponse) => {
            // 通信成功：正常なGETリクエスト、かつ自分自身のドメインのファイルのみを最新キャッシュとして保存
            if (event.request.method === 'GET' && networkResponse.status === 200 && event.request.url.startsWith(self.location.origin)) {
                const clonedResponse = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clonedResponse);
                });
            }
            return networkResponse; // 常に最新のファイルを返す
            
        }).catch(() => {
            // 通信失敗（オフライン時）：スマホに保存されているキャッシュから探す
            return caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
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