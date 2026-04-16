// src/billing/VIPInvite.js
import { BioAuth } from '../security/BioAuth.js';

export class VIPInvite {
    // ★ 開発者（あなた）だけが知るマスターキー。
    // この鍵で署名されたチケットだけをOSは「本物」と認識します。
    // （※本来は .env 等で管理しますが、デモとして強力な乱数文字列を定義）
    static MASTER_SECRET = "CYBER-NEXUS-OS-GOD-KEY-999-ULTIMATE";

    /**
     * 【開発者用】指定した権限と日数の暗号化チケットを生成する
     */
    static async generateTicket(tier, daysValid) {
        const exp = Date.now() + (daysValid * 24 * 60 * 60 * 1000);
        const payload = {
            t: tier, // 'PRO' or 'NORMAL'
            e: exp,  // 有効期限タイムスタンプ
            r: Math.random().toString(36).substring(2, 10).toUpperCase() // 偽造防止の乱数
        };
        
        // JSONをBase64に変換
        const dataStr = btoa(JSON.stringify(payload));
        // マスターキーを使って改ざん防止の署名（ハッシュ）を作成
        const signature = await this.hashSignature(dataStr, this.MASTER_SECRET);
        
        // チケット完成：「NEXUS-[権限]-[データ].[署名]」
        return `NEXUS-${tier}-${dataStr}.${signature}`;
    }

    /**
     * WebCrypto API を使った強固なSHA-256ハッシュ生成
     */
    static async hashSignature(data, secret) {
        const msgUint8 = new TextEncoder().encode(data + secret);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16); // 16文字の署名
    }

    /**
     * 【ユーザー用】入力されたコードの改ざん・期限をチェックし、生体バインドする
     */
    static async processInvite(app) {
        if (!(await BioAuth.isSupported())) {
            alert("⚠️ お使いの端末は生体認証（WebAuthn）をサポートしていません。");
            return;
        }

        const currentTier = localStorage.getItem('universe_vip_tier');
        if (currentTier === 'PRO') {
            alert("✅ このデバイスは既に【PRO権限】でバインドされています。");
            return;
        }

        const code = prompt("【機密アクセス】招待コードを入力してください：\n（※開発者専用コンソールを開くにはマスターキーを入力）");
        if (!code) return;

        // ★ 隠しコマンド：マスターキーを直接入力した時だけ、開発者用コンソール（GOD MODE）を開く
        if (code === this.MASTER_SECRET || code === "GOD") {
            const { AdminUI } = await import('../ui/AdminUI.js');
            AdminUI.open(app);
            return;
        }

        try {
            // 1. チケットの形式と署名を検証
            if (!code.startsWith('NEXUS-')) throw new Error("無効なチケット形式です。");
            
            const parts = code.split('-');
            const tokenPart = parts.slice(2).join('-'); // NEXUS-PRO- の後を取り出す
            const [base64Data, signature] = tokenPart.split('.');

            if (!base64Data || !signature) throw new Error("チケットが破損しています。");

            // 署名が一致するか（開発者が発行した本物か）確認
            const expectedSig = await this.hashSignature(base64Data, this.MASTER_SECRET);
            if (signature !== expectedSig) {
                throw new Error("⚠️ 偽造・改ざんされたチケットです！アクセスを拒否しました。");
            }

            // 2. 中身のデータを取り出して有効期限をチェック
            const payload = JSON.parse(atob(base64Data));
            if (Date.now() > payload.e) {
                const expDate = new Date(payload.e).toLocaleDateString();
                throw new Error(`このチケットは有効期限（${expDate}）が切れています。`);
            }

            // 3. 検証成功！生体認証デバイスバインドへ進む
            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
            alert(`✅ ${payload.t}権限のチケットを確認しました。\nこのコードをこのデバイスに永久バインドするため、生体情報（指紋/顔認証）を要求します。`);

            const credentialId = await BioAuth.registerDevice();

            // デバイスに権限と期限を書き込む
            localStorage.setItem('universe_vip_credential', credentialId);
            localStorage.setItem('universe_vip_tier', payload.t); // 'PRO' or 'NORMAL'
            localStorage.setItem('universe_vip_exp', payload.e);

            alert(`🎉 [BINDING SUCCESS]\n生体情報のバインドが完了しました。\nあなたは ${payload.t} 権限で宇宙にアクセスできます。`);
            if (window.universeAudio) window.universeAudio.playWarp();
            
            // 画面をリロードして権限を適用
            window.location.reload();

        } catch (e) {
            if (window.universeAudio) window.universeAudio.playSystemSound(100, 'sawtooth', 0.5);
            alert(`🚨 アクセス拒否:\n${e.message}`);
        }
    }

    /**
     * 起動時に権限と有効期限をチェックする
     */
    static checkTier() {
        const tier = localStorage.getItem('universe_vip_tier');
        const exp = localStorage.getItem('universe_vip_exp');

        if (!tier || !exp) return 'GUEST'; // 未登録はゲスト扱い

        if (Date.now() > parseInt(exp, 10)) {
            // 期限切れの場合は権限を剥奪
            localStorage.removeItem('universe_vip_tier');
            alert("⚠️ VIPチケットの有効期限が切れました。ゲスト権限に戻ります。");
            return 'GUEST';
        }

        return tier; // 'PRO' または 'NORMAL'
    }
}