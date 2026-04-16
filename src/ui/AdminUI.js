// src/ui/AdminUI.js
import { VIPInvite } from '../billing/VIPInvite.js';

export class AdminUI {
    static open(app) {
        if (document.getElementById('admin-console-ui')) return;

        const ui = document.createElement('div');
        ui.id = 'admin-console-ui';
        ui.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: 360px; background: rgba(20, 0, 0, 0.95); border: 1px solid #ff0000;
            border-radius: 12px; z-index: 999999; padding: 25px; color: #fff;
            box-shadow: 0 0 50px rgba(255, 0, 0, 0.5); backdrop-filter: blur(15px);
            font-family: monospace; display: flex; flex-direction: column; gap: 15px;
        `;

        ui.innerHTML = `
            <div style="text-align:center; color:#ff4444; font-weight:bold; font-size:18px; border-bottom:1px dashed #ff4444; padding-bottom:10px; letter-spacing:2px;">
                👁️ GOD CONSOLE
            </div>
            
            <div style="font-size:12px; color:#aaa; text-align:center; margin-bottom:10px;">
                VIPチケット暗号生成エンジン
            </div>

            <div>
                <div style="font-size:11px; color:#ff8888; margin-bottom:5px;">TIER (付与する権限)</div>
                <div style="display:flex; gap:10px;">
                    <label style="flex:1; background:rgba(255,0,0,0.1); border:1px solid #ff4444; padding:8px; border-radius:6px; cursor:pointer; text-align:center;">
                        <input type="radio" name="admin-tier" value="PRO" checked style="accent-color:#ff4444;"> PRO版
                    </label>
                    <label style="flex:1; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; padding:8px; border-radius:6px; cursor:pointer; text-align:center;">
                        <input type="radio" name="admin-tier" value="NORMAL" style="accent-color:#00ffcc;"> 通常版
                    </label>
                </div>
            </div>

            <div>
                <div style="font-size:11px; color:#ff8888; margin-bottom:5px;">VALIDITY (有効期限)</div>
                <select id="admin-days" style="width:100%; background:rgba(0,0,0,0.5); color:#fff; border:1px solid #ff4444; padding:10px; border-radius:6px; outline:none; font-family:monospace;">
                    <option value="1">1日間 (トライアル)</option>
                    <option value="7">7日間 (ウィークリー)</option>
                    <option value="30" selected>30日間 (マンスリー)</option>
                    <option value="365">365日間 (年間パス)</option>
                    <option value="99999">無期限 (永久機関)</option>
                </select>
            </div>

            <button id="admin-generate-btn" style="width:100%; padding:15px; background:#440000; color:#ff4444; border:1px solid #ff0000; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; margin-top:10px; transition:0.2s; text-shadow:0 0 5px #ff0000;">
                🩸 招待コードを錬成する
            </button>

            <div id="admin-output-container" style="display:none; flex-direction:column; gap:5px; margin-top:10px;">
                <div style="font-size:11px; color:#00ffcc;">GENERATED TICKET:</div>
                <textarea id="admin-output-code" readonly style="width:100%; height:60px; background:rgba(0,255,204,0.05); color:#00ffcc; border:1px dashed #00ffcc; padding:10px; border-radius:6px; box-sizing:border-box; outline:none; resize:none; font-size:10px; word-break:break-all;"></textarea>
                <button id="admin-copy-btn" style="padding:8px; background:#004444; color:#00ffcc; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;">📄 コピーして顧客に渡す</button>
            </div>

            <button id="admin-close-btn" style="width:100%; padding:10px; background:transparent; color:#888; border:none; cursor:pointer; margin-top:10px;">コンソールを閉じる</button>
        `;

        document.body.appendChild(ui);

        document.getElementById('admin-close-btn').onclick = () => ui.remove();

        document.getElementById('admin-generate-btn').onclick = async () => {
            const tier = document.querySelector('input[name="admin-tier"]:checked').value;
            const days = parseInt(document.getElementById('admin-days').value, 10);
            
            // VIPInviteの暗号化ジェネレーターを呼び出す
            const ticketCode = await VIPInvite.generateTicket(tier, days);
            
            const outContainer = document.getElementById('admin-output-container');
            const outText = document.getElementById('admin-output-code');
            outText.value = ticketCode;
            outContainer.style.display = 'flex';

            if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.2);
        };

        document.getElementById('admin-copy-btn').onclick = (e) => {
            const code = document.getElementById('admin-output-code').value;
            navigator.clipboard.writeText(code);
            e.target.innerText = "✅ コピー完了！";
            setTimeout(() => e.target.innerText = "📄 コピーして顧客に渡す", 2000);
        };
    }
}