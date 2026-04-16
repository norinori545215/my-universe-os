// src/billing/VIPInvite.js

export class VIPInvite {
    // 開発者のみが知るシステムマスターキー（※外部には絶対に漏らさない）
    static SECRET = "CYBER-NEXUS-OS-GOD-KEY-999-ULTIMATE";

    static async generateTicket(tier, daysValid) {
        const exp = Date.now() + (daysValid * 24 * 60 * 60 * 1000);
        const payload = { 
            t: tier, 
            e: exp, 
            r: Math.random().toString(36).substring(2, 10).toUpperCase() 
        };
        const dataStr = btoa(JSON.stringify(payload));
        const signature = await this.hashSignature(dataStr, this.SECRET);
        return `NEXUS-${tier}-${dataStr}.${signature}`;
    }

    static async hashSignature(data, secret) {
        const msgUint8 = new TextEncoder().encode(data + secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    static async verifyTicket(code) {
        const parts = code.split('-');
        if (parts.length < 3) throw new Error("無効なチケット形式です。");
        
        const tokenPart = parts.slice(2).join('-');
        const [base64Data, signature] = tokenPart.split('.');
        if (!base64Data || !signature) throw new Error("チケットが破損しています。");

        const expectedSig = await this.hashSignature(base64Data, this.SECRET);
        if (signature !== expectedSig) throw new Error("偽造・改ざんされたチケットです。");

        const payload = JSON.parse(atob(base64Data));
        if (Date.now() > payload.e) throw new Error("有効期限が切れています。");
        
        return payload;
    }
}