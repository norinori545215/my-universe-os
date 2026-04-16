// src/security/BioAuth.js

export class BioAuth {
    /**
     * デバイスが指紋/顔認証（WebAuthn）をサポートしているか確認
     */
    static async isSupported() {
        return window.PublicKeyCredential !== undefined;
    }

    /**
     * 端末の生体情報を読み取り、新しい「宇宙の鍵（公開鍵）」を生成する
     */
    static async registerDevice() {
        // 偽造不可能なランダムチャレンジ
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const userId = crypto.getRandomValues(new Uint8Array(16));

        const publicKey = {
            challenge: challenge,
            rp: { 
                name: "My Universe OS",
                // localhostまたは実際のドメイン名を自動取得
                id: window.location.hostname 
            },
            user: { 
                id: userId, 
                name: "VIP_Diver", 
                displayName: "VIP Diver" 
            },
            // ES256 (楕円曲線暗号) を使用
            pubKeyCredParams: [{ type: "public-key", alg: -7 }], 
            authenticatorSelection: { 
                authenticatorAttachment: "platform", // スマホやPC本体の認証器（TouchID/FaceID等）を強制
                userVerification: "required" 
            },
            timeout: 60000,
            attestation: "direct"
        };

        try {
            // ここでOSネイティブの指紋/顔認証プロンプトが立ち上がる
            const credential = await navigator.credentials.create({ publicKey });
            
            // 生成されたクレデンシャルID（ハードウェア紐付けキー）をBase64に変換して返す
            return btoa(String.fromCharCode(...new Uint8Array(credential.rawId)));
        } catch (err) {
            console.error(err);
            throw new Error("生体認証の登録に失敗、またはキャンセルされました。");
        }
    }

    /**
     * 登録済みの端末かどうか、再度生体認証をして検証する
     */
    static async authenticateDevice(storedCredentialIdBase64) {
        const challenge = crypto.getRandomValues(new Uint8Array(32));
        const credentialId = Uint8Array.from(atob(storedCredentialIdBase64), c => c.charCodeAt(0));

        const publicKey = {
            challenge: challenge,
            allowCredentials: [{ type: "public-key", id: credentialId }],
            userVerification: "required",
            timeout: 60000
        };

        try {
            // ここで再度OSネイティブの生体認証プロンプトが立ち上がる
            const assertion = await navigator.credentials.get({ publicKey });
            return true;
        } catch (err) {
            console.error(err);
            throw new Error("生体認証に失敗したか、登録されたデバイスではありません。");
        }
    }
}