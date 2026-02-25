// src/db/LocalVault.js

/**
 * 🔒 My Universe OS - 地下金庫 (IndexedDB)
 * Firebaseに繋がらない圏外やオフライン状態でも宇宙を展開できるよう、
 * 暗号化されたカプセルをブラウザの深層大容量ストレージに保管する。
 */

const DB_NAME = 'MyUniverse_DeepVault';
const STORE_NAME = 'EncryptedUniverses';

export class LocalVault {
    // 地下金庫の扉を開ける（なければ作る）
    static async openVault() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // 宇宙の暗号カプセルを地下金庫に放り込む
    static async save(encryptedData) {
        try {
            const db = await this.openVault();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readwrite');
                const store = tx.objectStore(STORE_NAME);
                // 'latest_capsule' という固定の箱に常に最新の宇宙を上書き保存
                const request = store.put(encryptedData, 'latest_capsule');
                
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.warn("地下金庫への保存に失敗しました:", e);
            return false;
        }
    }

    // 地下金庫から宇宙の暗号カプセルを取り出す
    static async load() {
        try {
            const db = await this.openVault();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(STORE_NAME, 'readonly');
                const store = tx.objectStore(STORE_NAME);
                const request = store.get('latest_capsule');
                
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.warn("地下金庫からの取り出しに失敗しました:", e);
            return null;
        }
    }

    // （緊急用）地下金庫を完全に爆破する
    static async destroyVault() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(DB_NAME);
            request.onsuccess = () => resolve(true);
            request.onerror = () => reject(request.error);
        });
    }
}