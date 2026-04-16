// src/billing/VIPInvite.js
import { BioAuth } from '../security/BioAuth.js';

export class VIPInvite {
    // ※今回はローカルテスト用モック。実稼働時は暗号化されたP2P/FirebaseのDBと照合します
    static VALID_CODES = ['CYBER-PRO-2026', 'NEXUS-VIP-001'];

    /**
     * コードを入力させ、生体情報とバインドする
     */
    static async processInvite(app) {
        if (!(await BioAuth.isSupported())) {
            alert("⚠️ お使いの端末・ブラウザは生体認証（WebAuthn）をサポートしていません。");
            return;
        }

        // 既にバインドされているかチェック
        if (localStorage.getItem('universe_vip_credential')) {
            alert("✅ このデバイスは既にVIPプロトコルにバインドされています。");
            return;
        }

        const code = prompt("【機密アクセス】VIP招待コードを入力してください：");
        if (!code) return;

        // コードの妥当性チェック
        if (!this.VALID_CODES.includes(code)) {
            alert("❌ 無効なコード、または既に使用されたコードです。");
            if (window.universeAudio) window.universeAudio.playSystemSound(100, 'sawtooth', 0.5);
            return;
        }

        try {
            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.1);
            alert("🧬 デバイスの生体情報（指紋/顔認証）を要求します。\nこのデバイスを宇宙の「マスターキー」として物理登録します。プロンプトに従ってください。");

            // 生体認証の実行（WebAuthn起動）
            const credentialId = await BioAuth.registerDevice();

            // 成功した場合、ハードウェアキーと招待コードをローカル金庫に焼き付ける
            localStorage.setItem('universe_vip_credential', credentialId);
            localStorage.setItem('universe_vip_code', code);

            alert("🎉 [VIP BINDING SUCCESS]\nあなたの生体情報がこの宇宙に刻み込まれました。\n今後、このコードの権限はこのデバイスの生体認証でのみ引き出せます。");
            if (window.universeAudio) window.universeAudio.playWarp();

            // OSのPRO機能を解放（必要に応じてapp側のフラグを立てる）
            if (app) app.isVIP = true;

        } catch (e) {
            alert(`🚨 バインディング エラー:\n${e.message}`);
        }
    }

    /**
     * 宇宙の起動時や重要機能アクセス時に、本当に本人のデバイスか再検証する
     */
    static async verifyAccess() {
        const credId = localStorage.getItem('universe_vip_credential');
        if (!credId) return true; // VIP未登録なら通常のアクセスとして通す（要件に応じて変更可）

        try {
            // 再度指紋/顔認証を要求
            await BioAuth.authenticateDevice(credId);
            return true;
        } catch (e) {
            return false;
        }
    }
}