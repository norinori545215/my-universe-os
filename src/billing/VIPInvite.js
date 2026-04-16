// src/billing/VIPInvite.js
export class VIPInvite {
    static SECRET = "CYBER-NEXUS-OS-GOD-KEY-999-ULTIMATE";

    static async generateTicket(tier, daysValid, recipientName) {
        const exp = Date.now() + (daysValid * 24 * 60 * 60 * 1000);
        const payload = { t: tier, e: exp, n: recipientName, r: Math.random().toString(36).substring(2, 7) };
        const dataStr = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const signature = await this.hashSignature(dataStr, this.SECRET);
        return `NEXUS-${tier}-${dataStr}.${signature}`;
    }

    static async hashSignature(data, secret) {
        const msgUint8 = new TextEncoder().encode(data + secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 12);
    }

    static async verifyTicket(code) {
        const parts = code.split('-');
        if (parts.length < 3) throw new Error("チケット形式エラー");
        const tokenPart = parts.slice(2).join('-');
        const [base64Data, signature] = tokenPart.split('.');
        const expectedSig = await this.hashSignature(base64Data, this.SECRET);
        if (signature !== expectedSig) throw new Error("不正なコードです");
        const payload = JSON.parse(decodeURIComponent(escape(atob(base64Data))));
        if (Date.now() > payload.e) throw new Error("期限切れです");
        return payload;
    }
}