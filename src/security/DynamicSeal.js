// src/security/DynamicSeal.js

export class DynamicSeal {
    // パスワードから256bitの強固な暗号鍵を生成 (PBKDF2)
    static async deriveKey(password, salt) {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
        );
        return crypto.subtle.deriveKey(
            { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
            keyMaterial, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
        );
    }

    /**
     * 星の機密データをAES-GCMで完全に暗号化し、元のデータを破壊する
     */
    static async seal(node, password) {
        // 暗号化する機密データ
        const payload = JSON.stringify({
            name: node.name,
            note: node.note || "",
            url: node.url || "",
            iconUrl: node.iconUrl || ""
        });

        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await this.deriveKey(password, salt);

        const enc = new TextEncoder();
        const encrypted = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv }, key, enc.encode(payload)
        );

        // 🌟 【絶対守護】元の平文データをメモリ上から物理的に消去・上書き
        node.name = "🔒 封印された星";
        node.note = "";
        node.url = "";
        node.iconUrl = "";

        // 暗号化されたバイナリだけを保存
        node.sealData = {
            ciphertext: Array.from(new Uint8Array(encrypted)),
            iv: Array.from(iv),
            salt: Array.from(salt)
        };

        node.isLocked = true;
        node.isTempUnlocked = false;
        delete node.lockCode; // 平文パスワードは絶対に保持しない
    }

    /**
     * 暗号化された星を復号し、元のデータを復元する
     */
    static async unseal(node, password) {
        if (!node.sealData) return false;

        try {
            const salt = new Uint8Array(node.sealData.salt);
            const iv = new Uint8Array(node.sealData.iv);
            const ciphertext = new Uint8Array(node.sealData.ciphertext);

            const key = await this.deriveKey(password, salt);
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv }, key, ciphertext
            );

            const dec = new TextDecoder();
            const payload = JSON.parse(dec.decode(decrypted));

            // 🌟 復号成功時のみデータを復元
            node.name = payload.name;
            node.note = payload.note;
            node.url = payload.url;
            node.iconUrl = payload.iconUrl;

            return true;
        } catch (e) {
            // パスワード間違い、またはデータ破損時
            return false;
        }
    }
}