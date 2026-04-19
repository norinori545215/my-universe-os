// src/security/LoginGateway.js
import { BioAuth } from './BioAuth.js';
import { VIPInvite } from '../billing/VIPInvite.js';

export class LoginGateway {
    static ADMIN_EMAIL = "tokimogulife_0313@yahoo.co.jp";

    static async boot() {
        return new Promise((resolve) => {
            const boundCred = localStorage.getItem('universe_bound_credential');
            const currentRole = localStorage.getItem('universe_role');

            const ui = document.createElement('div');
            ui.id = 'login-gateway';
            ui.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh; background:#050510; z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#00ffcc; font-family:sans-serif;`;

            // 【2回目以降】生体認証ログイン
            if (boundCred) {
                ui.innerHTML = `
                    <div style="font-size:24px; color:#ff00ff; font-weight:bold; letter-spacing:3px; margin-bottom:40px;">NEXUS OS</div>
                    <button id="btn-bio" style="padding:15px 40px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; color:#00ffcc; border-radius:8px; cursor:pointer; font-size:16px; font-weight:bold;">生体認証でログイン</button>
                    <button id="btn-reset" style="margin-top:30px; background:transparent; border:none; color:#666; cursor:pointer; font-size:11px; text-decoration:underline;">別のアカウントでログイン（初期化）</button>
                `;
                document.body.appendChild(ui);
                
                document.getElementById('btn-bio').onclick = async () => {
                    try {
                        await BioAuth.authenticateDevice(boundCred);
                        this.handleRoleRouting(currentRole, ui, resolve);
                    } catch (e) { alert("認証失敗"); }
                };
                document.getElementById('btn-reset').onclick = () => {
                    if(confirm("ローカルデータを消去して初期化しますか？")) { localStorage.clear(); sessionStorage.clear(); window.location.reload(); }
                };
            } 
            // 【初回】Email / PW ログイン画面
            else {
                this.renderLoginForm(ui, resolve);
            }
        });
    }

    static renderLoginForm(ui, resolve) {
        ui.innerHTML = `
            <div style="width:320px; background:rgba(20,20,30,0.9); padding:30px; border:1px solid #333; border-radius:12px; box-shadow:0 10px 30px rgba(0,0,0,0.8);">
                <div style="font-size:22px; color:#fff; font-weight:bold; margin-bottom:20px; text-align:center;">LOGIN</div>
                
                <div id="login-mode-email">
                    <input type="email" id="gate-email" placeholder="Email Address" style="width:100%; box-sizing:border-box; background:#111; border:1px solid #444; color:#fff; padding:12px; border-radius:6px; margin-bottom:15px; outline:none;">
                    <input type="password" id="gate-pass" placeholder="Password" style="width:100%; box-sizing:border-box; background:#111; border:1px solid #444; color:#fff; padding:12px; border-radius:6px; margin-bottom:20px; outline:none;">
                    <button id="gate-enter" style="width:100%; padding:12px; background:#00ffcc; color:#000; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; margin-bottom:15px;">ログイン</button>
                    <div style="text-align:center;"><button id="toggle-vip" style="background:transparent; border:none; color:#ff00ff; cursor:pointer; font-size:12px; text-decoration:underline;">VIPコードをお持ちの方はこちら</button></div>
                </div>

                <div id="login-mode-vip" style="display:none;">
                    <div style="font-size:11px; color:#ffaa00; margin-bottom:10px; text-align:center;">※Email登録不要でアクセスできます</div>
                    <input type="text" id="gate-vip-code" placeholder="NEXUS-..." style="width:100%; box-sizing:border-box; background:#111; border:1px solid #ffaa00; color:#ffaa00; padding:12px; border-radius:6px; margin-bottom:20px; outline:none;">
                    <button id="gate-vip-enter" style="width:100%; padding:12px; background:#ffaa00; color:#000; border:none; border-radius:6px; cursor:pointer; font-weight:bold; font-size:14px; margin-bottom:15px;">コードでログイン</button>
                    <div style="text-align:center;"><button id="toggle-email" style="background:transparent; border:none; color:#888; cursor:pointer; font-size:12px; text-decoration:underline;">Emailログインに戻る</button></div>
                </div>
            </div>
        `;
        document.body.appendChild(ui);

        const modeEmail = document.getElementById('login-mode-email');
        const modeVip = document.getElementById('login-mode-vip');

        document.getElementById('toggle-vip').onclick = () => { modeEmail.style.display = 'none'; modeVip.style.display = 'block'; };
        document.getElementById('toggle-email').onclick = () => { modeVip.style.display = 'none'; modeEmail.style.display = 'block'; };

        // ★ Emailとパスワードでのログイン処理
        document.getElementById('gate-enter').onclick = async () => {
            const email = document.getElementById('gate-email').value.trim();
            const pass = document.getElementById('gate-pass').value.trim();
            if (!email || !pass) return alert("Emailとパスワードを入力してください");

            let role = 'RESTRICTED';
            if (email === this.ADMIN_EMAIL) {
                // 開発者アカウント
                role = 'ADMIN';
            } else {
                // 既存のセーブデータがあればVIP(PRO)、なければ新規(RESTRICTED)として扱う
                const hasLocalData = localStorage.getItem('my_universe_save_data');
                role = hasLocalData ? 'PRO' : 'RESTRICTED';
            }
            this.executeDeviceBinding(role, ui, resolve);
        };

        // ★ VIPコード（顧客・特別な人）のログイン処理
        document.getElementById('gate-vip-enter').onclick = async () => {
            const code = document.getElementById('gate-vip-code').value.trim();
            if (!code) return;
            try {
                const payload = await VIPInvite.verifyTicket(code);
                // チケットに埋め込まれた権限（通常はPRO）を適用
                this.executeDeviceBinding(payload.t, ui, resolve);
            } catch (e) { alert(`コードエラー: ${e.message}`); }
        };
    }

    static async executeDeviceBinding(role, ui, resolve) {
        try {
            alert(`認証成功：デバイスを生体認証と紐付けます。`);
            const credId = await BioAuth.registerDevice();
            localStorage.setItem('universe_bound_credential', credId);
            localStorage.setItem('universe_role', role);
            this.handleRoleRouting(role, ui, resolve);
        } catch (e) {
            alert("生体認証の登録に失敗しました。");
        }
    }

    // ★ 開発者なら「2択画面」を出し、それ以外は即座にOSを起動
    static handleRoleRouting(role, ui, resolve) {
        if (role === 'ADMIN') {
            ui.innerHTML = `
                <div style="font-size:20px; color:#ff4444; font-weight:bold; margin-bottom:40px; letter-spacing:2px;">DEVELOPER AUTHORIZED</div>
                <div style="display:flex; gap:20px; flex-direction:column; align-items:center;">
                    <button id="btn-admin-console" style="padding:20px; background:#440000; border:1px solid #ff0000; color:#fff; border-radius:10px; cursor:pointer; font-weight:bold; font-size:16px; width:350px; transition:0.2s;">
                        🎟️ ① 招待コード発行 ＆ ゲスト制限設定
                    </button>
                    <button id="btn-admin-os" style="padding:20px; background:#003344; border:1px solid #00ffcc; color:#fff; border-radius:10px; cursor:pointer; font-weight:bold; font-size:16px; width:350px; transition:0.2s;">
                        🌌 ② 従来通りのOS画面を起動 (PRO)
                    </button>
                </div>
            `;
            // ①が選ばれたら main.js に 'ROUTE_ADMIN_PORTAL' という合図を返す
            document.getElementById('btn-admin-console').onclick = () => {
                ui.style.opacity = '0'; setTimeout(() => { ui.remove(); resolve('ROUTE_ADMIN_PORTAL'); }, 500);
            };
            // ②が選ばれたら OS起動
            document.getElementById('btn-admin-os').onclick = () => {
                ui.style.opacity = '0'; setTimeout(() => { ui.remove(); resolve('ADMIN'); }, 500);
            };
        } else {
            // 既存ユーザー(PRO)、新規ユーザー(RESTRICTED)、顧客(PRO) はそのままOS起動
            ui.style.opacity = '0'; setTimeout(() => { ui.remove(); resolve(role); }, 500);
        }
    }
}