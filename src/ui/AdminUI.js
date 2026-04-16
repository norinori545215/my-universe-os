// src/ui/AdminUI.js
import { VIPInvite } from '../billing/VIPInvite.js';

export class AdminUI {
    static open() {
        if (document.getElementById('god-app-window')) return;

        const win = document.createElement('div');
        win.id = 'god-app-window';
        win.style.cssText = `position:fixed; top:50%; left:50%; transform:translate(-50%, -50%); width:380px; background:rgba(15,0,0,0.95); border:2px solid #ff0000; border-radius:15px; z-index:999999; padding:25px; color:#fff; box-shadow:0 0 50px rgba(255,0,0,0.5); backdrop-filter:blur(20px); font-family:monospace;`;

        win.innerHTML = `
            <div style="text-align:center; color:#ff4444; font-weight:bold; font-size:20px; border-bottom:1px solid #ff4444; padding-bottom:15px; margin-bottom:20px; letter-spacing:5px;">GOD CONSOLE</div>
            
            <div style="margin-bottom:15px;">
                <label style="font-size:10px; color:#ff8888;">RECIPIENT NAME (把握用名前)</label>
                <input type="text" id="adm-name" placeholder="例: 佐藤 健太" style="width:100%; background:#220000; border:1px solid #ff4444; color:#fff; padding:10px; border-radius:5px; margin-top:5px; outline:none;">
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-size:10px; color:#ff8888;">VALIDITY (有効期限)</label>
                <select id="adm-days" style="width:100%; background:#220000; border:1px solid #ff4444; color:#fff; padding:10px; border-radius:5px; margin-top:5px; outline:none;">
                    <option value="7">7日間</option>
                    <option value="30" selected>30日間</option>
                    <option value="99999">無期限</option>
                </select>
            </div>

            <button id="adm-gen-btn" style="width:100%; padding:15px; background:#660000; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; margin-top:10px;">🩸 新しいVIPコードを錬成</button>

            <div id="adm-result" style="display:none; margin-top:20px;">
                <textarea id="adm-code" readonly style="width:100%; height:80px; background:#000; color:#00ffcc; border:1px dashed #00ffcc; padding:10px; font-size:11px; resize:none;"></textarea>
                <div style="font-size:9px; color:#00ffcc; margin-top:5px;">※このコードをコピーして顧客に渡してください</div>
            </div>

            <button id="adm-close" style="width:100%; margin-top:20px; background:transparent; color:#888; border:none; cursor:pointer;">× 閉じる</button>
        `;

        document.body.appendChild(win);

        document.getElementById('adm-gen-btn').onclick = async () => {
            const name = document.getElementById('adm-name').value || "Unknown";
            const days = parseInt(document.getElementById('adm-days').value);
            const code = await VIPInvite.generateTicket('PRO', days, name);
            
            document.getElementById('adm-code').value = code;
            document.getElementById('adm-result').style.display = 'block';
            if(window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.3);
        };

        document.getElementById('adm-close').onclick = () => win.remove();
    }
}