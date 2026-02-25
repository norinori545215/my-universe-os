// src/db/LocalVault.js

/**
 * 🔒 My Universe OS - 地下金庫 (IndexedDB)
 * Firebaseに繋がらない圏外やオフライン状態でも宇宙を展開できるよう、
 * 暗号化されたカプセルをブラウザの深層大容量ストレージに保管する。
 * 【NEW】宇宙のすべての歴史（操作ログ）を記録する機能を追加。
 */

const DB_NAME = 'MyUniverse_DeepVault';
const STORE_NAME = 'EncryptedUniverses';
const LOG_STORE_NAME = 'UniverseLogs'; // ★ ログ専用の新しい箱の名前

export class LocalVault {
    // 地下金庫の扉を開ける（なければ作る）
    static async openVault() {
        return new Promise((resolve, reject) => {
            // ★ バージョンを「2」に上げることで、金庫の改築（箱の追加）をブラウザに指示します
            const request = indexedDB.open(DB_NAME, 2);
            
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                // 1. 宇宙カプセル用の箱
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
                // ★ 2. ログ記録用の新しい箱（自動で連番が振られる設定）
                if (!db.objectStoreNames.contains(LOG_STORE_NAME)) {
                    db.createObjectStore(LOG_STORE_NAME, { autoIncrement: true });
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

    // ★ 【NEW】宇宙で起きた出来事（ログ）を地下金庫に刻み込む
    static async saveLog(logEntry) {
        try {
            const db = await this.openVault();
            return new Promise((resolve, reject) => {
                const tx = db.transaction(LOG_STORE_NAME, 'readwrite');
                const store = tx.objectStore(LOG_STORE_NAME);
                // add() を使うことで、上書きせずどんどん時系列で追加されていきます
                const request = store.add(logEntry);
                
                request.onsuccess = () => resolve(true);
                request.onerror = () => reject(request.error);
            });
        } catch (e) {
            console.warn("ログの保存に失敗しました:", e);
            return false;
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