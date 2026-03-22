// src/security/SecretNexus.js

export class SecretNexus {
    // 1. ユーザー固有の鍵ペア（公開鍵・秘密鍵）を生成 (ECDH方式)
    static async generateIdentity() {
        const keyPair = await crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" },
            true,
            ["deriveKey", "deriveBits"]
        );
        const publicKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
        const privateKeyJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
        
        return { publicKey: publicKeyJwk, privateKey: privateKeyJwk };
    }

    // 2. 自分の秘密鍵と、通信相手の公開鍵を混ぜ合わせて「2人だけの共通暗号鍵」を錬成
    static async deriveSharedSecret(myPrivateKeyJwk, peerPublicKeyJwk) {
        const myPrivateKey = await crypto.subtle.importKey(
            "jwk", myPrivateKeyJwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]
        );
        const peerPublicKey = await crypto.subtle.importKey(
            "jwk", peerPublicKeyJwk, { name: "ECDH", namedCurve: "P-256" }, true, []
        );
        
        return await crypto.subtle.deriveKey(
            { name: "ECDH", public: peerPublicKey },
            myPrivateKey,
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    }

    // 3. 共通鍵を使ってメッセージ（またはファイルメタデータ）を暗号化
    static async encryptData(text, sharedKey) {
        const enc = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            sharedKey,
            enc.encode(text)
        );
        
        return {
            cipher: Array.from(new Uint8Array(encrypted)), // JSON化して送受信しやすい配列に変換
            iv: Array.from(iv)
        };
    }

    // 4. 受け取った暗号データを復号
    static async decryptData(encryptedObj, sharedKey) {
        try {
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(encryptedObj.iv) },
                sharedKey,
                new Uint8Array(encryptedObj.cipher)
            );
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            console.error("Nexus Decryption Failed:", e);
            return "[ 復号エラー: 鍵が不一致か、データが干渉を受けています ]";
        }
    }

    // 5. 【エスクロー用】一時的なワンタイムキーでデータを封印する
    static async createEscrowPayload(dataString) {
        const oneTimeKey = await crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
        );
        const encrypted = await this.encryptData(dataString, oneTimeKey);
        const exportedKey = await crypto.subtle.exportKey("jwk", oneTimeKey);
        
        return {
            payload: encrypted, // 相手の画面に先に表示させる「ロックされたデータ」
            unlockKey: exportedKey // 条件を満たした時（承認時など）にだけ相手に送信する「鍵」
        };
    }

    // 6. 【エスクロー用】受け取ったワンタイムキーで封印を解く
    static async unlockEscrow(payload, unlockKeyJwk) {
        const key = await crypto.subtle.importKey(
            "jwk", unlockKeyJwk, { name: "AES-GCM" }, true, ["decrypt"]
        );
        return await this.decryptData(payload, key);
    }
}