// src/security/SecretNexus.js

export class SecretNexus {
    // 🌐 運営のマスター公開鍵（エスクロー用ダミー）
    // ※ 本番環境では、運営が安全なオフライン環境で生成した公開鍵のJWKに差し替えてください
    static ADMIN_MASTER_PUB_JWK = {
        kty: "RSA",
        e: "AQAB",
        n: "t2_H4X... (ダミーのRSA公開鍵モジュラス。本来は長大なBase64URL文字列が入ります。今回はテスト用に生成ロジックを内包します)",
        alg: "RSA-OAEP-256",
        ext: true,
    };

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

    // ★ 内部ヘルパー: エスクロー用のマスター公開鍵を取得（テスト自動生成対応）
    static async getAdminPublicKey() {
        let savedJwk = localStorage.getItem('universe_admin_escrow_pub');
        if (!savedJwk) {
            // テスト用に即席のマスターRSAキーを生成してローカルに記憶
            const keyPair = await crypto.subtle.generateKey(
                { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
                true, ["encrypt", "decrypt"]
            );
            savedJwk = JSON.stringify(await crypto.subtle.exportKey("jwk", keyPair.publicKey));
            localStorage.setItem('universe_admin_escrow_pub', savedJwk);
            localStorage.setItem('universe_admin_escrow_priv', JSON.stringify(await crypto.subtle.exportKey("jwk", keyPair.privateKey))); // 傍受テスト用
        }
        return await crypto.subtle.importKey("jwk", JSON.parse(savedJwk), { name: "RSA-OAEP", hash: "SHA-256" }, true, ["encrypt"]);
    }

    // 3. 【ハイブリッド暗号化】UI側からは今まで通り呼び出すだけで、内部で3重カプセル化を実行
    static async encryptData(text, sharedKey) {
        const enc = new TextEncoder();
        
        // ① メッセージごとの使い捨てセッション鍵を生成
        const sessionKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
        const rawSessionKey = await crypto.subtle.exportKey("raw", sessionKey);

        // ② 使い捨て鍵で実際のテキストを暗号化
        const textIv = crypto.getRandomValues(new Uint8Array(12));
        const encryptedText = await crypto.subtle.encrypt({ name: "AES-GCM", iv: textIv }, sessionKey, enc.encode(text));

        // ③ 使い捨て鍵を「P2Pの共通鍵」で暗号化（相手用）
        const p2pIv = crypto.getRandomValues(new Uint8Array(12));
        const p2pEncryptedKey = await crypto.subtle.encrypt({ name: "AES-GCM", iv: p2pIv }, sharedKey, rawSessionKey);

        // ④ 使い捨て鍵を「運営のマスター公開鍵」で暗号化（エスクロー・バックドア用）
        const adminPubKey = await this.getAdminPublicKey();
        const adminEncryptedKey = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, adminPubKey, rawSessionKey);

        // ⑤ すべてを1つのJSONペイロードに圧縮し、UIが期待する {cipher, iv} の形に偽装して返す
        const hybridPayload = {
            t: Array.from(new Uint8Array(encryptedText)), // Text
            ti: Array.from(textIv),                       // Text IV
            pk: Array.from(new Uint8Array(p2pEncryptedKey)), // Peer Key
            pi: Array.from(p2pIv),                        // Peer IV
            ak: Array.from(new Uint8Array(adminEncryptedKey)) // Admin Key
        };

        const payloadString = JSON.stringify(hybridPayload);
        return {
            cipher: Array.from(enc.encode(payloadString)), // UI側はこの配列を保存する
            iv: [] // ハイブリッド内包のため、外部IVはダミー
        };
    }

    // 4. 【ハイブリッド復号】受け取った暗号データを自動解凍して復号
    static async decryptData(encryptedObj, sharedKey) {
        try {
            // ① 偽装されたJSONペイロードを開封
            const dec = new TextDecoder();
            const payloadString = dec.decode(new Uint8Array(encryptedObj.cipher));
            const hybridPayload = JSON.parse(payloadString);

            // ② P2P共通鍵を使って「使い捨てセッション鍵」を救出
            const rawSessionKey = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(hybridPayload.pi) },
                sharedKey,
                new Uint8Array(hybridPayload.pk)
            );

            // ③ 救出したセッション鍵を再構築
            const sessionKey = await crypto.subtle.importKey(
                "raw", rawSessionKey, { name: "AES-GCM" }, false, ["decrypt"]
            );

            // ④ セッション鍵で本来のテキストを復号
            const decryptedText = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: new Uint8Array(hybridPayload.ti) },
                sessionKey,
                new Uint8Array(hybridPayload.t)
            );

            return new TextDecoder().decode(decryptedText);
        } catch (e) {
            console.error("Nexus Decryption Failed (Hybrid):", e);
            return "[ 復号エラー: 量子干渉を検知しました ]";
        }
    }
}