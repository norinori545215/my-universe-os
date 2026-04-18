// src/ui/AdminUI.js
import { VIPInvite } from '../billing/VIPInvite.js';

export class AdminUI {
    static renderInside(container, resolveOSBoot) {
        container.innerHTML = `
            <div style="width:400px; background:rgba(20,0,0,0.95); border:1px solid #ff0000; border-radius:12px; padding:30px; box-shadow:0 0 50px rgba(255,0,0,0.3); color:#fff; font-family:sans-serif;">
                <div style="text-align:center; color:#ff4444; font-weight:bold; font-size:20px; border-bottom:1px solid #ff4444; padding-bottom:15px; margin-bottom:20px;">
                    VIPチケット管理コンソール
                </div>

                <div style="margin-bottom:15px;">
                    <div style="font-size:12px; color:#ff8888; margin-bottom:5px;">付与する権限</div>
                    <select id="adm-tier" style="width:100%; background:#111; border:1px solid #ff4444; color:#fff; padding:10px; border-radius:5px; outline:none;">
                        <option value="PRO">PRO版 (全機能解放)</option>
                        <option value="GUEST_UNLOCK">制限解除版 (一部機能解放)</option>
                    </select>
                </div>

                <div style="margin-bottom:15px;">
                    <div style="font-size:12px; color:#ff8888; margin-bottom:5px;">有効期限 (日数) ※自由入力可能</div>
                    <input type="number" id="adm-days" value="30" min="1" max="36500" style="width:100%; box-sizing:border-box; background:#111; border:1px solid #ff4444; color:#fff; padding:10px; border-radius:5px; outline:none;">
                    <div style="font-size:10px; color:#aaa; margin-top:5px;">※ 36500 と入力すれば約100年間有効になります。</div>
                </div>

                <button id="adm-gen-btn" style="width:100%; padding:15px; background:#880000; color:#fff; border:none; border-radius:5px; font-weight:bold; cursor:pointer; margin-top:10px; font-size:14px;">
                    コードを生成する
                </button>

                <div id="adm-result" style="display:none; margin-top:20px;">
                    <textarea id="adm-code" readonly style="width:100%; box-sizing:border-box; height:70px; background:#000; color:#00ffcc; border:1px dashed #00ffcc; padding:10px; font-size:11px; resize:none;"></textarea>
                    <button id="adm-copy-btn" style="width:100%; padding:10px; background:#004444; color:#00ffcc; border:none; border-radius:4px; cursor:pointer; font-weight:bold; margin-top:5px;">コピーする</button>
                </div>

                <div style="margin-top:30px; border-top:1px solid #333; padding-top:20px;">
                    <button id="adm-boot-os" style="width:100%; padding:12px; background:transparent; border:1px solid #aaa; color:#aaa; border-radius:5px; cursor:pointer; font-weight:bold;">OSを起動する (コンソール終了)</button>
                </div>
            </div>
        `;

        document.getElementById('adm-gen-btn').onclick = async () => {
            const tier = document.getElementById('adm-tier').value;
            const days = parseInt(document.getElementById('adm-days').value, 10) || 30;
            const code = await VIPInvite.generateTicket(tier, days);
            
            document.getElementById('adm-code').value = code;
            document.getElementById('adm-result').style.display = 'block';
        };

        document.getElementById('adm-copy-btn').onclick = (e) => {
            navigator.clipboard.writeText(document.getElementById('adm-code').value);
            e.target.innerText = "✅ コピー完了！";
            setTimeout(() => e.target.innerText = "コピーする", 2000);
        };

        document.getElementById('adm-boot-os').onclick = () => {
            container.style.opacity = '0';
            setTimeout(() => { container.remove(); resolveOSBoot('ADMIN'); }, 500);
        };
    }
}