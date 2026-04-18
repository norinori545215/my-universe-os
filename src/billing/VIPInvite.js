// src/billing/VIPInvite.js

export class VIPInvite {
    // ★ システムを統括するマスターキー（※外部には絶対に漏らさないこと）
    static SECRET = "CYBER-NEXUS-OS-GOD-KEY-999-ULTIMATE";

    /**
     * 【開発者専用】記名式・期限付きコードを発行する
     * @param {string} tier - 付与する権限 ('PRO', 'RESTRICTED' など)
     * @param {number} daysValid - 有効日数
     * @param {string} recipientName - 誰に渡したか（管理メモ）
     */
    static async generateTicket(tier, daysValid, recipientName) {
        // 1. 有効期限（ミリ秒）を計算
        const exp = Date.now() + (daysValid * 24 * 60 * 60 * 1000);
        
        // 2. ペイロード（中身）を作成
        const payload = { 
            t: tier, 
            e: exp, 
            n: recipientName, 
            r: Math.random().toString(36).substring(2, 7).toUpperCase() // 偽造防止のランダム文字列
        };
        
        // 3. 日本語（recipientName）が含まれていても安全にBase64化する処理
        const dataStr = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        
        // 4. 改ざん防止のための暗号署名を作成
        const signature = await this.hashSignature(dataStr, this.SECRET);
        
        // 5. 最終的なコードの形に組み上げる
        const ticketCode = `NEXUS-${tier}-${dataStr}.${signature}`;

        // 6. （オプション）開発者のブラウザに発行履歴を保存しておく
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
        // 16進数の文字列に変換し、先頭12文字を署名として使用
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 12);
    }

    /**
     * 【Gateway用】入力されたコードの改ざん・期限をチェックし、中身を取り出す
     */
    static async verifyTicket(code) {
        // 1. フォーマットの確認
        const parts = code.split('-');
        if (parts.length < 3) {
            throw new Error("無効なチケット形式です。");
        }
        
        // 2. データ部分と署名部分を分離
        const tokenPart = parts.slice(2).join('-');
        const [base64Data, signature] = tokenPart.split('.');
        
        if (!base64Data || !signature) {
            throw new Error("チケットが破損しています。");
        }

        // 3. 署名の検証（開発者が発行した本物かどうか）
        const expectedSig = await this.hashSignature(base64Data, this.SECRET);
        if (signature !== expectedSig) {
            throw new Error("偽造・改ざんされた不正なコードです。");
        }

        // 4. データの解読（日本語対応）
        const payload = JSON.parse(decodeURIComponent(escape(atob(base64Data))));
        
        // 5. 有効期限の確認
        if (Date.now() > payload.e) {
            throw new Error("このコードの有効期限は切れています。");
        }
        
        return payload;
    }
}