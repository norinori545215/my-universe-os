// src/db/VaultMedia.js

export class VaultMedia {
    static dbName = 'MyUniverse_Vault';
    static storeName = 'EncryptedMedia';

    // IndexedDBの初期化
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

    // ランダムな暗号化キー（AES-GCM 256bit）を生成
    static async generateKey() {
        return await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    // 画像ファイルを暗号化して地下金庫（IndexedDB）へ格納
    static async storeMedia(file, node) {
        const db = await this.initDB();
        const arrayBuffer = await file.arrayBuffer();
        
        // 固有の鍵とIV（初期化ベクトル）を生成
        const key = await this.generateKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        // 暗号化の実行
        const encryptedData = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            arrayBuffer
        );

        // 鍵を文字列化（Nodeに保存するため）
        const exportedKey = await crypto.subtle.exportKey("jwk", key);
        const mediaId = 'media_' + crypto.randomUUID();

        // 金庫へ保存
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({
                id: mediaId,
                data: encryptedData,
                iv: iv,
                mimeType: file.type
            });

            request.onsuccess = () => {
                // 星（Node）のデータに鍵とIDだけを紐づける（超軽量化）
                if (!node.vault) node.vault = [];
                node.vault.push({
                    id: mediaId,
                    key: exportedKey
                });
                resolve(mediaId);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 星（Node）から暗号化データを引き出し、復号してメモリ上に展開
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
                    // 鍵の復元
                    const key = await crypto.subtle.importKey(
                        "jwk",
                        mediaMeta.key,
                        { name: "AES-GCM" },
                        true,
                        ["decrypt"]
                    );

                    // 復号処理
                    const decryptedData = await crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: record.iv },
                        key,
                        record.data
                    );

                    // メモリ上でのみ有効なBlob URLを生成（画面を閉じれば消滅）
                    const blob = new Blob([decryptedData], { type: record.mimeType });
                    resolve(URL.createObjectURL(blob));
                } catch (e) {
                    console.error("復号エラー:", e);
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // 星に格納されたすべての画像を消去
    static async purgeMedia(node) {
        if (!node.vault || node.vault.length === 0) return;
        const db = await this.initDB();
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        node.vault.forEach(meta => store.delete(meta.id));
        node.vault = [];
    }
}