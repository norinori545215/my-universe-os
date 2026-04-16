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
            ui.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh; background:#000; z-index:9999999; display:flex; flex-direction:column; justify-content:center; align-items:center; color:#00ffcc; font-family:monospace;`;

            if (boundCred) {
                // 【2回目以降】生体認証のみで一発ブート
                ui.innerHTML = `
                    <div style="font-size:18px; color:#ff00ff; letter-spacing:5px; margin-bottom:40px;">NEURAL LINK REQUIRED</div>
                    <div id="bio-touch" style="width:80px; height:80px; border:2px solid #00ffcc; display:flex; justify-content:center; align-items:center; cursor:pointer; font-size:40px;">🧬</div>
                `;
                document.body.appendChild(ui);
                document.getElementById('bio-touch').onclick = async () => {
                    try {
                        await BioAuth.authenticateDevice(boundCred);
                        ui.style.opacity = '0'; setTimeout(() => { ui.remove(); resolve(currentRole); }, 500);
                    } catch (e) { alert("認証失敗"); }
                };
            } else {
                // 【初回】Email、またはVIPコードの入力
                ui.innerHTML = `
                    <div style="font-size:24px; color:#ff00ff; font-weight:bold; letter-spacing:3px; margin-bottom:10px;">NEXUS GATEWAY</div>
                    <div style="font-size:11px; color:#aaa; margin-bottom:40px; text-align:center;">Email、または開発者から提供されたVIPコードを入力</div>
                    <input type="password" id="gate-pass" style="width:300px; background:rgba(255,255,255,0.05); border:1px solid #ff00ff; color:#fff; padding:15px; text-align:center; font-size:16px; margin-bottom:20px; outline:none;">
                    <button id="gate-enter" style="width:300px; padding:15px; background:#440044; color:#ff00ff; border:1px solid #ff00ff; font-weight:bold; cursor:pointer;">認証開始</button>
                `;
                document.body.appendChild(ui);

                document.getElementById('gate-enter').onclick = async () => {
                    const val = document.getElementById('gate-pass').value.trim();
                    if (!val) return;

                    try {
                        let role = 'NORMAL';
                        
                        if (val === this.ADMIN_EMAIL) {
                            role = 'ADMIN';
                        } else if (val.startsWith('NEXUS-')) {
                            const payload = await VIPInvite.verifyTicket(val);
                            role = payload.t; // PRO等
                        } else if (val.includes('@')) {
                            // 今日までにデータがある人はVIP(PRO)、それ以外はNORMAL
                            const hasLocalData = localStorage.getItem('my_universe_save_data');
                            role = hasLocalData ? 'PRO' : 'NORMAL';
                        }

                        alert(`検証成功：${role}権限。次に生体登録を行います。`);
                        const credId = await BioAuth.registerDevice();
                        
                        localStorage.setItem('universe_bound_credential', credId);
                        localStorage.setItem('universe_role', role);

                        ui.style.opacity = '0'; setTimeout(() => { ui.remove(); resolve(role); }, 500);
                    } catch (e) { alert(`アクセス拒否: ${e.message}`); }
                };
            }
        });
    }
}