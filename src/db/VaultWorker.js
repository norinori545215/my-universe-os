// src/db/VaultWorker.js

// IndexedDBの初期化（Worker内専用）
const dbName = 'MyUniverse_Vault';
const storeName = 'EncryptedMedia';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(storeName)) {
                db.createObjectStore(storeName, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// メインスレッドからの指令を受信
self.onmessage = async (e) => {
    const { action, file, mediaId } = e.data;

    if (action === 'ENCRYPT_AND_STORE') {
        try {
            // 1. ファイルの読み込み（メインスレッドを止めない）
            const arrayBuffer = await file.arrayBuffer();
            
            // 2. 暗号鍵とIVの生成
            const key = await crypto.subtle.generateKey(
                { name: "AES-GCM", length: 256 },
                true, ["encrypt", "decrypt"]
            );
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // 3. AES-GCMで暗号化
            const encryptedData = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv }, key, arrayBuffer
            );

            // 4. 鍵をエクスポート（メインスレッドに返す用）
            const exportedKey = await crypto.subtle.exportKey("jwk", key);

            // 5. Worker内から直接 IndexedDB へ保存
            const db = await initDB();
            const transaction = db.transaction(storeName, 'readwrite');
            const store = transaction.objectStore(storeName);
            
            store.put({
                id: mediaId,
                data: encryptedData,
                iv: iv,
                mimeType: file.type
            });

            transaction.oncomplete = () => {
                // メインスレッドへ「成功」と「鍵」だけを返す（重いデータは返さない）
                self.postMessage({ status: 'SUCCESS', mediaId, exportedKey });
            };
            transaction.onerror = () => {
                throw new Error("DB保存エラー");
            };

        } catch (error) {
            self.postMessage({ status: 'ERROR', error: error.message });
        }
    }
};