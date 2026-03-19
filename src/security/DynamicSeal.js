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

        // ★ 修正：セーブシステムに消されないよう、標準プロパティの「password」に暗号データを格納する
        node.password = JSON.stringify(sealObj);
        node.isLocked = true;
        node.isTempUnlocked = false;

        node.name = "🔒 封印された星";
        node.note = "";
        node.url = "";
        node.iconUrl = "";
        
        if (node.lockCode) delete node.lockCode;
        if (node.sealData) delete node.sealData; 
    }

    static async unseal(node, password) {
        // ★ 修正：passwordプロパティから暗号データを読み込む
        if (!node.password) return false;

        // 古い平文パスワードの救済
        if (typeof node.password === 'string' && !node.password.startsWith('{')) {
            return node.password === password;
        }

        try {
            let sealObj;
            if (typeof node.password === 'string') {
                sealObj = JSON.parse(node.password);
            } else if (typeof node.password === 'object') {
                sealObj = node.password;
            } else {
                return false;
            }

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