// src/security/CryptoCore.js

/**
 * 🛡️ My Universe OS - 絶対守護コア (E2EE Encryption)
 * 文字列化(Base64)を廃止し、純粋なバイナリ(Uint8Array)による最高速・省メモリ駆動。
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
    
    // 毎回ランダムな初期化ベクトル（IV）を生成
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        cryptoKey,
        encodedData
    );

    // ★ Base64変換を廃止し、IndexedDBにそのまま保存できるバイナリを返す
    return {
        cipher: new Uint8Array(encryptedBuffer),
        iv: iv
    };
}

// 3. 別の端末で「暗号カプセル」を解読し、宇宙を復元する
export async function decryptUniverseData(encryptedObj, cryptoKey) {
    try {
        // ★ バイナリ(Uint8Array)から直接復号
        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: encryptedObj.iv },
            cryptoKey,
            encryptedObj.cipher
        );

        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decryptedBuffer));
    } catch (error) {
        throw new Error("⚠️ マスターパスワードが間違っているか、データが破損しています。");
    }
}