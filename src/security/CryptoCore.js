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

    // 保存しやすいように文字列（Base64）に変換して返す
    const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
    const encryptedBase64 = btoa(String.fromCharCode.apply(null, encryptedArray));
    const ivBase64 = btoa(String.fromCharCode.apply(null, Array.from(iv)));

    return {
        cipher: encryptedBase64,
        iv: ivBase64
    };
}

// 3. 別の端末で「暗号カプセル」を解読し、宇宙を復元する
export async function decryptUniverseData(encryptedObj, cryptoKey) {
    try {
        const encryptedArray = new Uint8Array(atob(encryptedObj.cipher).split('').map(c => c.charCodeAt(0)));
        const ivArray = new Uint8Array(atob(encryptedObj.iv).split('').map(c => c.charCodeAt(0)));

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivArray },
            cryptoKey,
            encryptedArray
        );

        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decryptedBuffer));
    } catch (error) {
        throw new Error("⚠️ マスターパスワードが間違っているか、データが破損しています。");
    }
}