// src/billing/VIPInvite.js
import { BioAuth } from '../security/BioAuth.js';

export class VIPInvite {
    // ★ 開発者のみが知るシステムマスターキー
    static SECRET = "CYBER-NEXUS-OS-GOD-KEY-999-ULTIMATE";
    
    // ★ 開発者の特権Email
    static ADMIN_EMAIL = "tokimogulife_0313@yahoo.co.jp";

    /**
     * 【開発者用】指定した権限と日数の暗号化チケットを生成する
     */
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

    /**
     * WebCrypto API を使った強固なSHA-256ハッシュ生成
     */
    static async hashSignature(data, secret) {
        const msgUint8 = new TextEncoder().encode(data + secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
    }

    /**
     * 【Gateway用】コードの改ざん・期限をチェックし、中身（ペイロード）を返す
     */
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

    /**
     * 【OS内部用】UIから呼び出される権限アップグレード＆生体バインド処理
     */
    static async processInvite(app) {
        if (!(await BioAuth.isSupported())) {
            alert("⚠️ お使いの端末は生体認証（WebAuthn）をサポートしていません。");
            return;
        }

        const currentRole = localStorage.getItem('universe_role');
        if (currentRole === 'PRO' || currentRole === 'ADMIN') {
            alert("✅ このデバイスは既に【PRO権限】以上でバインドされています。");
            return;
        }

        const code = prompt("【機密アクセス】招待コードを入力してください：\n（※開発者専用コンソールを開くにはマスターコマンドを入力）");
        if (!code) return;

        // ★ 隠しコマンド：マスターキーまたはGODと入力した場合
        if (code === this.SECRET || code === "GOD") {
            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
            
            const email = prompt("👁️ [GOD AUTHENTICATION]\n開発者権限を要求します。\nAdmin Emailを入力してください:");
            
            if (email === this.ADMIN_EMAIL) {
                const { AdminUI } = await import('../ui/AdminUI.js');
                AdminUI.open(app);
            } else {
                if (window.universeAudio) window.universeAudio.playSystemSound(100, 'sawtooth', 0.5);
                alert("❌ 認証失敗: 創造主のID（Email）と一致しません。アクセスを拒否しました。");
            }
            return;
        }

        try {
            // 1. チケットの検証
            const payload = await this.verifyTicket(code);

            // 2. 検証成功！生体認証デバイスバインドへ進む
            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
            alert(`✅ ${payload.t}権限のチケットを確認しました。\nこのコードをこのデバイスに永久バインドするため、生体情報（指紋/顔認証）を要求します。`);

            const credentialId = await BioAuth.registerDevice();

            // 3. デバイスに権限と期限を書き込む（アップグレード完了）
            localStorage.setItem('universe_bound_credential', credentialId);
            localStorage.setItem('universe_role', payload.t); // 'PRO'
            localStorage.setItem('universe_vip_exp', payload.e);

            alert(`🎉 [BINDING SUCCESS]\n生体情報のバインドが完了しました。\nあなたは ${payload.t} 権限で宇宙にアクセスできます。`);
            if (window.universeAudio) window.universeAudio.playWarp();
            
            // 画面をリロードして権限（PRO UI）を適用
            window.location.reload();

        } catch (e) {
            if (window.universeAudio) window.universeAudio.playSystemSound(100, 'sawtooth', 0.5);
            alert(`🚨 アクセス拒否:\n${e.message}`);
        }
    }
}