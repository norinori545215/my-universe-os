// src/billing/VIPInvite.js

export class VIPInvite {
    // 開発者のみが知るシステムマスターキー（※外部には絶対に漏らさないでください）
    static SECRET = "CYBER-NEXUS-OS-GOD-KEY-999-ULTIMATE";

    /**
     * 【開発者専用】記名式・期限付きコードを発行する
     */
    static async generateTicket(tier, daysValid, recipientName) {
        const exp = Date.now() + (daysValid * 24 * 60 * 60 * 1000);
        
        const payload = { 
            t: tier, 
            e: exp, 
            n: recipientName, 
            r: Math.random().toString(36).substring(2, 7).toUpperCase() // 偽造防止のランダム文字列
        };
        
        // 日本語が含まれていても安全にBase64化
        const dataStr = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const signature = await this.hashSignature(dataStr, this.SECRET);
        const ticketCode = `NEXUS-${tier}-${dataStr}.${signature}`;

        // 発行ログを開発者のローカルブラウザに保存
        try {
            const logs = JSON.parse(localStorage.getItem('universe_admin_logs') || '[]');
            logs.push({ ...payload, code: ticketCode, createdAt: Date.now() });
            localStorage.setItem('universe_admin_logs', JSON.stringify(logs));
        } catch (e) {
            console.warn("発行ログの保存に失敗しました", e);
        }

        return ticketCode;
    }

    /**
     * WebCrypto API を使った強固なSHA-256ハッシュ生成
     */
    static async hashSignature(data, secret) {
        const msgUint8 = new TextEncoder().encode(data + secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 12);
    }

    /**
     * 【Gateway用】入力されたコードの改ざん・期限をチェックし、中身を取り出す
     */
    static async verifyTicket(code) {
        const parts = code.split('-');
        if (parts.length < 3) {
            throw new Error("無効なチケット形式です。");
        }
        
        const tokenPart = parts.slice(2).join('-');
        const [base64Data, signature] = tokenPart.split('.');
        
        if (!base64Data || !signature) {
            throw new Error("チケットが破損しています。");
        }

        const expectedSig = await this.hashSignature(base64Data, this.SECRET);
        if (signature !== expectedSig) {
            throw new Error("偽造・改ざんされた不正なコードです。");
        }

        const payload = JSON.parse(decodeURIComponent(escape(atob(base64Data))));
        
        if (Date.now() > payload.e) {
            throw new Error("このコードの有効期限は切れています。");
        }
        
        return payload;
    }
}