// src/security/DynamicSeal.js

export class DynamicSeal {
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

    static async seal(node, password) {
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

        const sealObj = {
            ciphertext: Array.from(new Uint8Array(encrypted)),
            iv: Array.from(iv),
            salt: Array.from(salt)
        };

        node.lockCode = JSON.stringify(sealObj);
        node.isLocked = true;
        node.isTempUnlocked = false;

        node.name = "🔒 封印された星";
        node.note = "";
        node.url = "";
        node.iconUrl = "";
        
        if (node.sealData) delete node.sealData; 
    }

    static async unseal(node, password) {
        if (!node.lockCode) return false;

        // ★ 救済措置：古いシステム（暗号化前）で作られたパスワードならそのまま通す
        if (typeof node.lockCode === 'string' && !node.lockCode.startsWith('{')) {
            return node.lockCode === password;
        }

        try {
            // セーブデータの形式（文字列かオブジェクトか）に関わらず安全に読み込む
            let sealObj;
            if (typeof node.lockCode === 'string') {
                sealObj = JSON.parse(node.lockCode);
            } else if (typeof node.lockCode === 'object') {
                sealObj = node.lockCode;
            } else {
                return false;
            }

            // セーブ時に配列が崩れる現象への対策
            const getArray = (data) => Array.isArray(data) ? data : Object.values(data || {});

            const salt = new Uint8Array(getArray(sealObj.salt));
            const iv = new Uint8Array(getArray(sealObj.iv));
            const ciphertext = new Uint8Array(getArray(sealObj.ciphertext));

            const key = await this.deriveKey(password, salt);
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv }, key, ciphertext
            );

            const dec = new TextDecoder();
            const payload = JSON.parse(dec.decode(decrypted));

            // 復号成功時のみデータを復元
            node.name = payload.name;
            node.note = payload.note;
            node.url = payload.url;
            node.iconUrl = payload.iconUrl;

            return true;
        } catch (e) {
            console.error("Decrypt failed:", e);
            return false; 
        }
    }
}