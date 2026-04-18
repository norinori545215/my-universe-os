// src/security/AuthFlow.js
import { BioAuth } from './BioAuth.js';
import { VIPInvite } from '../billing/VIPInvite.js';
import { AdminPortal } from '../ui/AdminPortal.js';

export class AuthFlow {
    static DEV_EMAIL = "tokimogulife_0313@yahoo.co.jp";

    /**
     * 既存のログインフォーム（またはVIPコード入力）でボタンが押された時に呼ぶ
     * @param {string} inputString - Emailアドレス、またはVIPコード
     * @param {boolean} isExistingUser - Firebase等で「既に登録済みのユーザー」と判定されたか
     */
    static async handleLoginSuccess(inputString, isExistingUser) {
        try {
            let role = 'RESTRICTED';

            // ① 開発者のアカウントの場合
            if (inputString === this.DEV_EMAIL) {
                role = 'ADMIN';
            }
            // ② VIPコードが直接入力された場合
            else if (inputString.startsWith('NEXUS-')) {
                const payload = await VIPInvite.verifyTicket(inputString);
                role = payload.t; // 'PRO' や 'RESTRICTED' が入る
            }
            // ③ 通常のEmailログインの場合
            else if (inputString.includes('@')) {
                // 今日までに登録されていた既存ユーザーならPRO、新規なら制限付き
                role = isExistingUser ? 'PRO' : 'RESTRICTED';
            } else {
                throw new Error("無効な入力です。");
            }

            // 【共通要件】必ず生体認証を通す
            alert(`[System] ${role} 権限を確認しました。デバイスの生体認証（指紋/顔）を行ってください。`);
            const credId = await BioAuth.registerDevice();
            
            // 権限と生体鍵をローカルに記憶
            localStorage.setItem('universe_bound_credential', credId);
            localStorage.setItem('universe_role', role);

            // 分岐処理：開発者なら選択画面、それ以外はそのままOS起動
            if (role === 'ADMIN') {
                this.showDeveloperChoice();
            } else {
                if (window.startUniverseOS) window.startUniverseOS(role);
            }

        } catch (error) {
            alert(`🚨 アクセスエラー: ${error.message}`);
        }
    }

    /**
     * 開発者のみに出る「どっちの画面に行く？」の分岐UI
     */
    static showDeveloperChoice() {
        const ui = document.createElement('div');
        ui.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.9); z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#fff; font-family:monospace;`;

        ui.innerHTML = `
            <div style="font-size:20px; color:#ff4444; margin-bottom:30px;">開発者アカウントを検知しました</div>
            <button id="choice-portal" style="width:300px; padding:20px; margin-bottom:15px; background:#440000; border:1px solid #ff0000; color:#ff8888; font-size:16px; cursor:pointer; border-radius:8px;">① 招待コード発行ポータルへ</button>
            <button id="choice-os" style="width:300px; padding:20px; background:#003333; border:1px solid #00ffcc; color:#00ffcc; font-size:16px; cursor:pointer; border-radius:8px;">② 従来のOS画面へ</button>
        `;
        document.body.appendChild(ui);

        document.getElementById('choice-portal').onclick = () => {
            ui.remove();
            AdminPortal.render(); // 独立したチケット発行画面を出す
        };

        document.getElementById('choice-os').onclick = () => {
            ui.remove();
            if (window.startUniverseOS) window.startUniverseOS('ADMIN'); // OSを起動
        };
    }
}