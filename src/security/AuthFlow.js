// src/security/AuthFlow.js
import { BioAuth } from './BioAuth.js';
import { VIPInviteClient } from '../billing/VIPInviteClient.js';
import { AdminPortal } from '../ui/AdminPortal.js';
import { PermissionGate } from './PermissionGate.js';
import { auth } from './Auth.js';

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
            // 注意:
            // AdminPortal.js は PermissionGate で ADMIN 判定します。
            // そのため本番では、Firebase Custom Claims または Firestore users/{uid}.role 側にも
            // ADMIN を付与してください。
            if (inputString === this.DEV_EMAIL) {
                role = 'ADMIN';
            }

            // ② VIPコードが直接入力された場合
            else if (inputString.startsWith('NEXUS-')) {
                const result = await VIPInviteClient.verifyTicket(inputString);

                // 新方式のCloud Functionsは result.role を返す想定。
                // 旧VIPInvite互換として result.t も一応見る。
                role = result.role || result.t || 'RESTRICTED';

                // VIPコード検証後、Cloud Functions側でCustom Claimsが更新される可能性がある。
                // そのため、IDトークンを強制更新して最新権限を反映する。
                try {
                    if (auth?.currentUser) {
                        await auth.currentUser.getIdToken(true);
                    }
                } catch (tokenError) {
                    console.warn('[AuthFlow] IDトークン更新に失敗:', tokenError);
                }
            }

            // ③ 通常のEmailログインの場合
            else if (inputString.includes('@')) {
                // 今日までに登録されていた既存ユーザーならPRO、新規なら制限付き
                role = isExistingUser ? 'PRO' : 'RESTRICTED';
            }

            // ④ それ以外は無効
            else {
                throw new Error("無効な入力です。");
            }

            // 【共通要件】必ず生体認証を通す
            alert(`[System] ${role} 権限を確認しました。デバイスの生体認証（指紋/顔）を行ってください。`);

            const credId = await BioAuth.registerDevice();

            // 生体認証IDをローカルに記憶
            localStorage.setItem('universe_bound_credential', credId);

            // 既存UI互換用。
            // localStorage の role は「本物の権限」として信用しない。
            // 本当の権限判定は PermissionGate / Firebase Custom Claims / Firestore Rules 側で行う。
            PermissionGate.safeCacheForUIOnly(role);

            // 分岐処理：開発者なら選択画面、それ以外はそのままOS起動
            if (role === 'ADMIN') {
                this.showDeveloperChoice();
            } else {
                if (window.startUniverseOS) {
                    window.startUniverseOS(role);
                }
            }

        } catch (error) {
            console.error('[AuthFlow] アクセス処理に失敗:', error);
            alert(`🚨 アクセスエラー: ${error.message}`);
        }
    }

    /**
     * 開発者のみに出る「どっちの画面に行く？」の分岐UI
     */
    static showDeveloperChoice() {
        const ui = document.createElement('div');

        ui.style.cssText = `
            position:fixed;
            top:0;
            left:0;
            width:100vw;
            height:100vh;
            background:rgba(0,0,0,0.9);
            z-index:9999999;
            display:flex;
            flex-direction:column;
            justify-content:center;
            align-items:center;
            color:#fff;
            font-family:monospace;
        `;

        ui.innerHTML = `
            <div style="font-size:20px; color:#ff4444; margin-bottom:30px;">
                開発者アカウントを検知しました
            </div>

            <button id="choice-portal" style="width:300px; padding:20px; margin-bottom:15px; background:#440000; border:1px solid #ff0000; color:#ff8888; font-size:16px; cursor:pointer; border-radius:8px;">
                ① 招待コード発行ポータルへ
            </button>

            <button id="choice-os" style="width:300px; padding:20px; background:#003333; border:1px solid #00ffcc; color:#00ffcc; font-size:16px; cursor:pointer; border-radius:8px;">
                ② 従来のOS画面へ
            </button>
        `;

        document.body.appendChild(ui);

        document.getElementById('choice-portal').onclick = async () => {
            ui.remove();

            try {
                await AdminPortal.render(() => {
                    if (window.startUniverseOS) {
                        window.startUniverseOS('ADMIN');
                    }
                });
            } catch (error) {
                console.error('[AuthFlow] AdminPortal起動に失敗:', error);
                alert(`AdminPortalを起動できませんでした: ${error.message}`);
            }
        };

        document.getElementById('choice-os').onclick = () => {
            ui.remove();

            if (window.startUniverseOS) {
                window.startUniverseOS('ADMIN');
            }
        };
    }
}