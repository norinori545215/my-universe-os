// src/security/LoginGateway.js
import { BioAuth } from './BioAuth.js';
import { VIPInvite } from '../billing/VIPInvite.js';

export class LoginGateway {
    // ★ ここにあなたの特権ID（Email）を定義します
    static ADMIN_EMAIL = "tokimogulife_0313@yahoo.co.jp";

    static async boot() {
        return new Promise((resolve) => {
            const boundCred = localStorage.getItem('universe_bound_credential');
            const currentRole = localStorage.getItem('universe_role');

            const ui = document.createElement('div');
            ui.id = 'login-gateway';
            ui.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                background: #050510; z-index: 9999999; display: flex; flex-direction: column;
                justify-content: center; align-items: center; color: #00ffcc; font-family: monospace;
            `;

            if (boundCred) {
                // 【2回目以降】登録済み端末：即座に生体認証を要求
                ui.innerHTML = `
                    <div style="font-size:20px; margin-bottom:20px; color:#ff00ff; text-shadow: 0 0 10px #ff00ff; letter-spacing:3px;">NEXUS OS // LOCKED</div>
                    <div style="font-size:14px; margin-bottom:30px; animation: pulse 1.5s infinite;">🧬 SENSOR ACTIVE...</div>
                    <button id="btn-bio" style="padding:15px 40px; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; color:#00ffcc; border-radius:8px; cursor:pointer; font-size:16px; font-weight:bold; box-shadow: 0 0 15px rgba(0,255,204,0.3); transition:0.2s;">生体スキャンを開始</button>
                    <button id="btn-reset" style="margin-top:40px; background:transparent; border:none; color:#666; cursor:pointer; font-size:11px; text-decoration:underline;">端末の登録を解除して初期化</button>
                `;
                document.body.appendChild(ui);

                document.getElementById('btn-bio').onclick = async () => {
                    try {
                        await BioAuth.authenticateDevice(boundCred);
                        ui.style.opacity = '0'; setTimeout(() => { ui.remove(); resolve(currentRole); }, 500);
                    } catch (e) { alert("認証に失敗しました。もう一度試してください。"); }
                };
                
                document.getElementById('btn-reset').onclick = () => {
                    if(confirm("この端末の生体登録とすべてのローカルデータを完全に消去しますか？")) {
                        localStorage.clear(); sessionStorage.clear(); window.location.reload();
                    }
                };
            } else {
                // 【初回】パスワード、またはVIPコードを入力
                ui.innerHTML = `
                    <div style="font-size:24px; margin-bottom:10px; color:#ff00ff; font-weight:bold; text-shadow: 0 0 15px #ff00ff; letter-spacing:2px;">NEXUS GATEWAY</div>
                    <div style="font-size:12px; color:#aaa; margin-bottom:30px; text-align:center; line-height:1.6;">
                        【INITIAL SETUP】<br>パスワード、またはVIP招待コードを入力してください。<br>（※開発者は特権Emailを入力）
                    </div>
                    <input type="password" id="gate-pass" placeholder="Password / VIP Code" style="width:280px; background:rgba(0,0,0,0.5); border:1px solid #ff00ff; color:#fff; padding:15px; border-radius:8px; outline:none; text-align:center; font-size:16px; margin-bottom:20px; box-shadow: 0 0 10px rgba(255,0,255,0.2);">
                    <button id="gate-enter" style="width:280px; padding:15px; background:#440044; color:#ff00ff; border:1px solid #ff00ff; border-radius:8px; cursor:pointer; font-weight:bold; letter-spacing:2px; font-size:16px; transition:0.2s;">ENTER</button>
                `;
                document.body.appendChild(ui);

                document.getElementById('gate-enter').onclick = async () => {
                    const pass = document.getElementById('gate-pass').value.trim();
                    if (!pass) return;

                    try {
                        let role = 'NORMAL';
                        
                        // ① 開発者ログイン判定
                        if (pass === this.ADMIN_EMAIL) {
                            role = 'ADMIN';
                            alert("👁️ 創造主の帰還を確認しました。\n管理者権限でこのデバイスを物理ロック（生体バインド）します。");
                        } 
                        // ② VIPコードログイン判定
                        else if (pass.startsWith('NEXUS-')) {
                            const payload = await VIPInvite.verifyTicket(pass);
                            role = payload.t; // 'PRO' 等
                            alert(`✅ ${role}権限の招待チケットを確認しました。\nこのデバイスを物理ロック（生体バインド）します。`);
                        } 
                        // ③ 一般ユーザー（通常のパスワード）
                        else {
                            // ※本来はここでパスワードチェック処理などを挟む
                            alert("✅ 一般アクセスを確認しました。\nこのデバイスを物理ロック（生体バインド）します。");
                        }

                        // 生体情報の登録を実行（TouchID/FaceIDが起動）
                        const credId = await BioAuth.registerDevice();
                        
                        // 端末に鍵と権限を焼き付ける
                        localStorage.setItem('universe_bound_credential', credId);
                        localStorage.setItem('universe_role', role);

                        ui.style.opacity = '0'; setTimeout(() => { ui.remove(); resolve(role); }, 500);

                    } catch (e) {
                        alert(`🚨 アクセス拒否:\n${e.message}`);
                    }
                };
            }
        });
    }
}