// src/db/VaultWorker.js
const dbName = 'MyUniverse_Vault';
const storeName = 'EncryptedMedia';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onupgradeneeded = (e) => {
            if (!e.target.result.objectStoreNames.contains(storeName)) {
                e.target.result.createObjectStore(storeName, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

self.onmessage = async (e) => {
    const { action, file, mediaId } = e.data;
    if (action === 'ENCRYPT_AND_STORE') {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encryptedData = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, arrayBuffer);
            const exportedKey = await crypto.subtle.exportKey("jwk", key);

            const db = await initDB();
            const transaction = db.transaction(storeName, 'readwrite');
            transaction.objectStore(storeName).put({ id: mediaId, data: encryptedData, iv: iv, mimeType: file.type });

            transaction.oncomplete = () => self.postMessage({ status: 'SUCCESS', mediaId, exportedKey });
            transaction.onerror = () => { throw new Error("DB保存エラー"); };
        } catch (error) {
            self.postMessage({ status: 'ERROR', error: error.message });
        }
    }
};