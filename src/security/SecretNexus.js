// src/security/SecretNexus.js

export class SecretNexus {
    static ADMIN_MASTER_PUB_JWK = {
        kty: "RSA",
        e: "AQAB",
        n: "t2_H4X", // ダミー
        alg: "RSA-OAEP-256",
        ext: true,
    };

    // 1. ユーザー固有の鍵ペア（公開鍵・秘密鍵）を生成
    static async generateIdentity() {
        const keyPair = await crypto.subtle.generateKey(
            { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey", "deriveBits"]
        );
        return {
            publicKey: await crypto.subtle.exportKey("jwk", keyPair.publicKey),
            privateKey: await crypto.subtle.exportKey("jwk", keyPair.privateKey)
        };
    }

    // 2. 共通暗号鍵を錬成
    static async deriveSharedSecret(myPrivateKeyJwk, peerPublicKeyJwk) {
        const myPrivateKey = await crypto.subtle.importKey(
            "jwk", myPrivateKeyJwk, { name: "ECDH", namedCurve: "P-256" }, true, ["deriveKey"]
        );
        const peerPublicKey = await crypto.subtle.importKey(
            "jwk", peerPublicKeyJwk, { name: "ECDH", namedCurve: "P-256" }, true, []
        );
        return await crypto.subtle.deriveKey(
            { name: "ECDH", public: peerPublicKey }, myPrivateKey,
            { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
        );
    }

    static async getAdminPublicKey() {
        let savedJwk = localStorage.getItem('universe_admin_escrow_pub');
        if (!savedJwk) {
            const keyPair = await crypto.subtle.generateKey(
                { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
                true, ["encrypt", "decrypt"]
            );
            savedJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", keyPair.publicKey));
            localStorage.setItem('universe_admin_escrow_pub', savedJwk);
        }
        return await crypto.subtle.importKey("jwk", JSON.parse(savedJwk), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
    }

    // 3. 【ハイブリッド暗号化】画像をFirebaseに送れるよう、Base64文字列に圧縮
    static async encryptData(text, sharedKey) {
        const enc = new TextEncoder();
        const sessionKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        const rawSessionKey = await crypto.subtle.exportKey("raw", sessionKey);

        const textIv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedText = await crypto.subtle.encrypt({ name: "AES-GCM", iv: textIv }, sessionKey, enc.encode(text));

        const p2pIv = crypto.getRandomValues(new Uint8Array(12));
        const p2pEncryptedKey = await crypto.subtle.encrypt({ name: "AES-GCM", iv: p2pIv }, sharedKey, rawSessionKey);

        const adminPubKey = await this.getAdminPublicKey();
        const adminEncryptedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, adminPubKey, rawSessionKey);

        const hybridPayload = {
            t: Array.from(new Uint8Array(encryptedText)),
            ti: Array.from(textIv),
            pk: Array.from(new Uint8Array(p2pEncryptedKey)),
            pi: Array.from(p2pIv),
            ak: Array.from(new Uint8Array(adminEncryptedKey))
        };

        // ★ Firebaseの限界突破：巨大配列を文字列(Base64)に圧縮して送る
        const payloadString = JSON.stringify(hybridPayload);
        const base64Cipher = btoa(unescape(encodeURIComponent(payloadString)));

        return { cipher: base64Cipher, iv: "hybrid_v2" };
    }

    // 4. 【ハイブリッド復号】過去の古いデータと新しいデータを見分け、エラーを静かに処理
    static async decryptData(encryptedObj, sharedKey) {
        try {
            let payloadString;
            
            // ★ 自動判別：新しいBase64形式か、過去の重い配列形式かを見分ける
            if (typeof encryptedObj.cipher === 'string') {
                payloadString = decodeURIComponent(escape(atob(encryptedObj.cipher)));
            } else {
                const dec = new TextDecoder();
                payloadString = dec.decode(new Uint8Array(encryptedObj.cipher));
            }
            
            const hybridPayload = JSON.parse(payloadString);

            const rawSessionKey = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(hybridPayload.pi) }, sharedKey, new Uint8Array(hybridPayload.pk)
            );
            const sessionKey = await crypto.subtle.importKey(
                "raw", rawSessionKey, { name: "AES-GCM" }, false, ["decrypt"]
            );
            const decryptedText = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(hybridPayload.ti) }, sessionKey, new Uint8Array(hybridPayload.t)
            );

            return new TextDecoder().decode(decryptedText);
        } catch (e) {
            // ★ 修正：console.error を削除。赤いエラーを出さず、UI側に「読めないデータ」として静かに伝える
            throw new Error("Cannot Decrypt");
        }
    }
}