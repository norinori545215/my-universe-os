// src/security/CryptoCore.js

/**
 * 🛡️ My Universe OS - 絶対守護コア (E2EE Encryption)
 * Web Crypto APIを使用し、マスターパスワードからAES-GCM 256bitの暗号鍵を生成。
 * 宇宙のデータをFirebaseへ送る前に完全に秘匿化する。
 */

// 1. マスターパスワードから「宇宙の鍵（暗号鍵）」を生成する魔法
export async function deriveKey(masterPassword, saltHex = 'my-universe-os-salt-153bpm') {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw",
        enc.encode(masterPassword),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
    );

    // ソルト（塩）を混ぜて、パスワードの強度を10万倍に引き上げる
    const salt = enc.encode(saltHex);
    
    return window.crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: 100000, // 10万回こね回して解読不可能にする
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );
}

// ★ 追加：巨大なバイナリデータをスタックオーバーフローなしでBase64化する安全な関数
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    const chunkSize = 8192; // 8KBごとに分割処理（限界突破の回避）
    
    for (let i = 0; i < len; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
}

// ★ 追加：Base64からメモリを爆発させずにUint8Arrayに戻す安全な関数
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

// 2. 宇宙のデータを「暗号カプセル」に閉じ込める
export async function encryptUniverseData(dataObject, cryptoKey) {
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(dataObject));
    
    // 毎回ランダムな初期化ベクトル（IV）を生成（セキュリティの要）
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        cryptoKey,
        encodedData
    );

    // ★ 修正: チャンク分割による安全な変換を適用（音声や画像に対応）
    const encryptedBase64 = arrayBufferToBase64(encryptedBuffer);
    const ivBase64 = arrayBufferToBase64(iv);

    return {
        cipher: encryptedBase64,
        iv: ivBase64
    };
}

// 3. 別の端末で「暗号カプセル」を解読し、宇宙を復元する
export async function decryptUniverseData(encryptedObj, cryptoKey) {
    try {
        // ★ 修正: メモリセーフな解読変換を適用
        const encryptedArray = base64ToArrayBuffer(encryptedObj.cipher);
        const ivArray = base64ToArrayBuffer(encryptedObj.iv);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivArray },
            cryptoKey,
            encryptedArray
        );

        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decryptedBuffer));
    } catch (error) {
        console.error("復号エラー:", error);
        throw new Error("⚠️ マスターパスワードが間違っているか、データが破損しています。");
    }
}