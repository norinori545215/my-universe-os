// src/security/BioAuth.js

export class BioAuth {
    /**
     * WebAuthn (生体認証/パスキー) を用いてデバイスを登録する
     */
    static async registerDevice() {
        if (!window.PublicKeyCredential) {
            throw new Error("このブラウザ・端末は生体認証をサポートしていません。");
        }

        // 現在のドメインを自動取得 (127.0.0.1, localhost, 本番環境すべてに対応)
        const currentDomain = window.location.hostname;
        
        // ユーザー固有のランダムIDを生成
        const userId = crypto.getRandomValues(new Uint8Array(16));

        const publicKey = {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rp: {
                name: "NEXUS OS",
                id: currentDomain // ★ここで現在のURLを自動設定してSecurityErrorを回避
            },
            user: {
                id: userId,
                name: "nexus_user",
                displayName: "NEXUS User"
            },
            // ★警告を消すため、推奨アルゴリズム(ES256: -7, RS256: -257)を明記
            pubKeyCredParams: [
                { type: "public-key", alg: -7 },
                { type: "public-key", alg: -257 }
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform", // 端末内蔵の指紋・顔認証を指定
                userVerification: "required"
            },
            timeout: 60000,
            attestation: "direct"
        };

        try {
            const credential = await navigator.credentials.create({ publicKey });
            // 本来はここでサーバーに公開鍵を保存しますが、
            // 今回は端末紐付けのフラグとしてCredential IDのBase64文字列を返します
            const credentialId = btoa(String.fromCharCode.apply(null, new Uint8Array(credential.rawId)));
            return credentialId;
        } catch (err) {
            console.error("生体認証の登録に失敗しました:", err);
            throw err;
        }
    }

    /**
     * 登録済みのデバイスで生体認証（ログイン）を行う
     */
    static async authenticateDevice(expectedCredIdBase64) {
        if (!window.PublicKeyCredential) {
            throw new Error("生体認証がサポートされていません。");
        }

        const currentDomain = window.location.hostname;
        
        // 保存しておいたCredential IDをバイナリに変換して復元
        const binaryString = atob(expectedCredIdBase64);
        const expectedCredId = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            expectedCredId[i] = binaryString.charCodeAt(i);
        }

        const publicKey = {
            challenge: crypto.getRandomValues(new Uint8Array(32)),
            rpId: currentDomain, // ★ここも自動設定
            allowCredentials: [{
                type: "public-key",
                id: expectedCredId
            }],
            userVerification: "required",
            timeout: 60000
        };

        try {
            const assertion = await navigator.credentials.get({ publicKey });
            return assertion != null;
        } catch (err) {
            console.error("生体認証でのログインに失敗しました:", err);
            throw err;
        }
    }
}