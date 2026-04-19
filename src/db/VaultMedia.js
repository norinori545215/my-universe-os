// src/db/VaultMedia.js

export class VaultMedia {
    static dbName = 'MyUniverse_Vault';
    static storeName = 'EncryptedMedia';
    static worker = null;

    // Workerの初期化（シングルトン）
    static getWorker() {
        if (!this.worker) {
            this.worker = new Worker(new URL('./VaultWorker.js', import.meta.url), { type: 'module' });
        }
        return this.worker;
    }

    static async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    static async storeMedia(file, node) {
        const worker = this.getWorker();
        const mediaId = 'media_' + crypto.randomUUID();

        return new Promise((resolve, reject) => {
            // Workerからの返答を待つ
            const handleMessage = (e) => {
                if (e.data.mediaId !== mediaId) return; // 別のタスクの返答なら無視
                
                if (e.data.status === 'SUCCESS') {
                    if (!node.vault) node.vault = [];
                    // 重いデータはDBに入ったので、星には「鍵とメタデータ」だけを持たせる
                    node.vault.push({
                        id: mediaId,
                        key: e.data.exportedKey,
                        name: file.name,
                        type: file.type || 'application/octet-stream',
                        size: file.size
                    });
                    worker.removeEventListener('message', handleMessage);
                    resolve(mediaId);
                } else {
                    worker.removeEventListener('message', handleMessage);
                    reject(new Error(e.data.error));
                }
            };

            worker.addEventListener('message', handleMessage);

            // Workerへファイルをぶん投げる（UIフリーズ回避）
            worker.postMessage({ action: 'ENCRYPT_AND_STORE', file, mediaId });
        });
    }

    // retrieveMedia と purgeMedia, deleteMedia はIndexedDBからの読み取り・削除なので
    // 現状の VaultMedia.js のコード（前回のもの）をそのまま残してください。
    
    static async retrieveMedia(mediaMeta) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(mediaMeta.id);

            request.onsuccess = async () => {
                const record = request.result;
                if (!record) return resolve(null);
                try {
                    const key = await crypto.subtle.importKey(
                        "jwk", mediaMeta.key, { name: "AES-GCM" }, true, ["decrypt"]
                    );
                    const decryptedData = await crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: record.iv }, key, record.data
                    );
                    const blob = new Blob([decryptedData], { type: record.mimeType || mediaMeta.type });
                    resolve({
                        url: URL.createObjectURL(blob),
                        name: mediaMeta.name || 'encrypted_data.bin',
                        type: record.mimeType || mediaMeta.type
                    });
                } catch (e) {
                    console.error("復号エラー:", e);
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    static async purgeMedia(node) {
        if (!node.vault || node.vault.length === 0) return;
        const db = await this.initDB();
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        node.vault.forEach(meta => store.delete(meta.id));
        node.vault = [];
    }

    static async deleteMedia(mediaId) {
        const db = await this.initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(mediaId);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
}