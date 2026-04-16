// src/billing/VIPInvite.js
import { BioAuth } from '../security/BioAuth.js';

export class VIPInvite {
    // ★ 開発者のみが知るシステムマスターキー
    static SECRET = "CYBER-NEXUS-OS-GOD-KEY-999-ULTIMATE";
    
    // ★ 開発者の特権Email
    static ADMIN_EMAIL = "tokimogulife_0313@yahoo.co.jp";

    /**
     * 【開発者専用】記名式・期限付きコードの発行
     */
    static async generateTicket(tier, daysValid, recipientName) {
        const exp = Date.now() + (daysValid * 24 * 60 * 60 * 1000);
        const payload = { 
            t: tier, 
            e: exp, 
            n: recipientName, 
            r: Math.random().toString(36).substring(2, 7) 
        };
        const dataStr = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const signature = await this.hashSignature(dataStr, this.SECRET);
        
        // 発行ログをADMINのローカルに保存（必要に応じて）
        const logs = JSON.parse(localStorage.getItem('universe_admin_logs') || '[]');
        logs.push({ ...payload, code: `NEXUS-${tier}-${dataStr}.${signature}`, createdAt: Date.now() });
        localStorage.setItem('universe_admin_logs', JSON.stringify(logs));

        return `NEXUS-${tier}-${dataStr}.${signature}`;
    }

    /**
     * WebCrypto API を使った強固なハッシュ生成
     */
    static async hashSignature(data, secret) {
        const msgUint8 = new TextEncoder().encode(data + secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 12);
    }

    /**
     * 【Gateway用】コードの改ざん・期限をチェック
     */
    static async verifyTicket(code) {
        const parts = code.split('-');
        if (parts.length < 3) throw new Error("チケット形式エラー");
        const tokenPart = parts.slice(2).join('-');
        const [base64Data, signature] = tokenPart.split('.');
        
        const expectedSig = await this.hashSignature(base64Data, this.SECRET);
        if (signature !== expectedSig) throw new Error("不正なコードです");

        const payload = JSON.parse(decodeURIComponent(escape(atob(base64Data))));
        if (Date.now() > payload.e) throw new Error("有効期限が切れています");
        return payload;
    }

    /**
     * 【OS内部用】UIManagerから呼ばれる権限アップグレード処理
     */
    static async processInvite(app) {
        const currentRole = localStorage.getItem('universe_role');
        if (currentRole === 'PRO' || currentRole === 'ADMIN') {
            alert("✅ このデバイスは既に【PRO権限】以上です。");
            return;
        }

        const code = prompt("【権限昇格】VIP招待コードを入力してください：\n（※開発者コンソールを開くにはマスターコマンドを入力）");
        if (!code) return;

        // ★ 隠しコマンド：マスターキーまたはGODと入力した場合
        if (code === this.SECRET || code === "GOD") {
            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
            
            const email = prompt("👁️ [GOD AUTHENTICATION]\nAdmin Emailを入力してください:");
            
            if (email === this.ADMIN_EMAIL) {
                const { AdminUI } = await import('../ui/AdminUI.js');
                AdminUI.open(app);
            } else {
                if (window.universeAudio) window.universeAudio.playSystemSound(100, 'sawtooth', 0.5);
                alert("❌ 認証失敗: 創造主のIDと一致しません。");
            }
            return;
        }

        try {
            // チケットの検証
            const payload = await this.verifyTicket(code);

            // 検証成功！権限をアップデート
            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
            alert(`✅ ${payload.t}権限のチケットを確認しました。\nシステムを再起動してUIのロックを解除します。`);

            localStorage.setItem('universe_role', payload.t); 
            localStorage.setItem('universe_vip_exp', payload.e);

            // 画面をリロードしてPRO権限を適用
            window.location.reload();

        } catch (e) {
            if (window.universeAudio) window.universeAudio.playSystemSound(100, 'sawtooth', 0.5);
            alert(`🚨 アクセス拒否:\n${e.message}`);
        }
    }
}