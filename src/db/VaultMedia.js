// src/db/VaultMedia.js

export class VaultMedia {
    static dbName = 'MyUniverse_Vault';
    static storeName = 'EncryptedMedia';

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

    static async generateKey() {
        return await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    static async storeMedia(file, node) {
        const db = await this.initDB();
        const arrayBuffer = await file.arrayBuffer();
        
        const key = await this.generateKey();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encryptedData = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            arrayBuffer
        );

        const exportedKey = await crypto.subtle.exportKey("jwk", key);
        const mediaId = 'media_' + crypto.randomUUID();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(this.storeName, 'readwrite');
            const store = transaction.objectStore(this.storeName);
            
            // ★ ArrayBufferのまま安全にIndexedDBへ秘匿保存
            const request = store.put({
                id: mediaId,
                data: encryptedData,
                iv: iv,
                mimeType: file.type
            });

            request.onsuccess = () => {
                if (!node.vault) node.vault = [];
                // ★ V2拡張：ファイル名と種類、サイズも星に記憶させる
                node.vault.push({
                    id: mediaId,
                    key: exportedKey,
                    name: file.name,
                    type: file.type || 'application/octet-stream',
                    size: file.size
                });
                resolve(mediaId);
            };
            request.onerror = () => reject(request.error);
        });
    }

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
                        "jwk",
                        mediaMeta.key,
                        { name: "AES-GCM" },
                        true,
                        ["decrypt"]
                    );

                    const decryptedData = await crypto.subtle.decrypt(
                        { name: "AES-GCM", iv: record.iv },
                        key,
                        record.data
                    );

                    const blob = new Blob([decryptedData], { type: record.mimeType || mediaMeta.type });
                    
                    // ★ V2拡張：URLだけでなく、メタデータも一緒に返す
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
}