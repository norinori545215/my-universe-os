// src/security/CryptoCore.js

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
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
}

export async function encryptUniverseData(dataObject, cryptoKey) {
    const enc = new TextEncoder();
    const encodedData = enc.encode(JSON.stringify(dataObject));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, cryptoKey, encodedData
    );

    // ★Firebaseと相性の良いBase64仕様に戻す（クラウド同期を優先）
    const encryptedArray = Array.from(new Uint8Array(encryptedBuffer));
    return {
        cipher: btoa(String.fromCharCode.apply(null, encryptedArray)),
        iv: btoa(String.fromCharCode.apply(null, Array.from(iv)))
    };
}

export async function decryptUniverseData(encryptedObj, cryptoKey) {
    try {
        let encryptedArray, ivArray;

        // ★過去のデータ(Base64文字列)か、新しいデータ(Uint8Array)かを自動判定
        if (typeof encryptedObj.cipher === 'string') {
            encryptedArray = new Uint8Array(atob(encryptedObj.cipher).split('').map(c => c.charCodeAt(0)));
            ivArray = new Uint8Array(atob(encryptedObj.iv).split('').map(c => c.charCodeAt(0)));
        } else {
            encryptedArray = encryptedObj.cipher;
            ivArray = encryptedObj.iv;
        }

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: ivArray },
            cryptoKey,
            encryptedArray
        );

        const dec = new TextDecoder();
        return JSON.parse(dec.decode(decryptedBuffer));
    } catch (error) {
        console.error("復号エラー詳細:", error);
        throw new Error("⚠️ マスターパスワードが間違っているか、データが破損しています。");
    }
}