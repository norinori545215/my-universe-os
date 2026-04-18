// src/ui/AdminPortal.js
import { VIPInvite } from '../billing/VIPInvite.js';

export class AdminPortal {
    static render() {
        // 既存の画面を覆い隠す完全独立の全画面UI
        const ui = document.createElement('div');
        ui.id = 'admin-portal-screen';
        ui.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #0a0000; z-index: 9999999; display: flex; flex-direction: column;
            align-items: center; padding-top: 50px; color: #fff; font-family: monospace;
            overflow-y: auto;
        `;

        ui.innerHTML = `
            <div style="text-align:center; margin-bottom:30px;">
                <div style="font-size:24px; color:#ff4444; font-weight:bold; letter-spacing:5px;">👁️ CREATOR PORTAL</div>
                <div style="color:#aaa; font-size:12px; margin-top:5px;">招待コード発行・権限管理システム</div>
            </div>

            <div style="width: 90%; max-width: 500px; background: rgba(255,0,0,0.05); border: 1px solid #ff4444; border-radius: 12px; padding: 20px; box-shadow: 0 0 30px rgba(255,0,0,0.2);">
                <div style="margin-bottom: 20px;">
                    <label style="display:block; font-size:11px; color:#ff8888; margin-bottom:8px;">付与する権限 (TIER)</label>
                    <div style="display:flex; gap:10px;">
                        <label style="flex:1; background:rgba(255,0,0,0.1); border:1px solid #ff4444; padding:12px; border-radius:6px; cursor:pointer; text-align:center;">
                            <input type="radio" name="portal-tier" value="PRO" checked style="accent-color:#ff4444;"> PRO版 (全機能解放)
                        </label>
                        <label style="flex:1; background:rgba(0,255,204,0.1); border:1px solid #00ffcc; padding:12px; border-radius:6px; cursor:pointer; text-align:center;">
                            <input type="radio" name="portal-tier" value="RESTRICTED" style="accent-color:#00ffcc;"> 制限付き (ゲスト用)
                        </label>
                    </div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display:block; font-size:11px; color:#ff8888; margin-bottom:8px;">有効日数 (1日〜何百年でも設定可能)</label>
                    <input type="number" id="portal-days" value="30" min="1" max="365000" style="width:100%; background:#110000; border:1px solid #ff4444; color:#fff; padding:12px; border-radius:6px; outline:none; font-size:16px;">
                    <div style="font-size:10px; color:#aaa; margin-top:5px;">※ 永久にしたい場合は 36500 (100年) などと入力してください</div>
                </div>

                <div style="margin-bottom: 20px;">
                    <label style="display:block; font-size:11px; color:#ff8888; margin-bottom:8px;">宛先・メモ (誰に渡すコードか)</label>
                    <input type="text" id="portal-memo" placeholder="例: A社様 トライアル用" style="width:100%; background:#110000; border:1px solid #ff4444; color:#fff; padding:12px; border-radius:6px; outline:none; box-sizing:border-box;">
                </div>

                <button id="portal-generate-btn" style="width:100%; padding:15px; background:#440000; color:#ff4444; border:1px solid #ff0000; border-radius:8px; font-weight:bold; cursor:pointer; font-size:16px; transition:0.2s;">
                    🩸 コードを錬成する
                </button>

                <div id="portal-result" style="display:none; margin-top:20px; background:#000; padding:15px; border-radius:8px; border:1px dashed #00ffcc;">
                    <div style="font-size:11px; color:#00ffcc; margin-bottom:5px;">生成されたVIPコード:</div>
                    <textarea id="portal-code-output" readonly style="width:100%; height:80px; background:transparent; color:#00ffcc; border:none; resize:none; font-size:12px; outline:none;"></textarea>
                    <button id="portal-copy-btn" style="width:100%; padding:10px; background:#003333; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; cursor:pointer; font-weight:bold; margin-top:10px;">コピーする</button>
                </div>
            </div>

            <button id="portal-exit-btn" style="margin-top:30px; padding:10px 30px; background:transparent; border:1px solid #888; color:#888; border-radius:20px; cursor:pointer;">OS画面へ進む</button>
        `;

        document.body.appendChild(ui);

        // コード生成イベント
        document.getElementById('portal-generate-btn').onclick = async () => {
            const tier = document.querySelector('input[name="portal-tier"]:checked').value;
            const days = parseInt(document.getElementById('portal-days').value, 10);
            const memo = document.getElementById('portal-memo').value || "NO_NAME";
            
            const code = await VIPInvite.generateTicket(tier, days, memo);
            
            document.getElementById('portal-code-output').value = code;
            document.getElementById('portal-result').style.display = 'block';
            if (window.universeAudio) window.universeAudio.playSystemSound(800, 'square', 0.2);
        };

        // コピーイベント
        document.getElementById('portal-copy-btn').onclick = (e) => {
            navigator.clipboard.writeText(document.getElementById('portal-code-output').value);
            e.target.innerText = "✅ コピー完了";
            setTimeout(() => e.target.innerText = "コピーする", 2000);
        };

        // OS画面へ抜けるイベント
        document.getElementById('portal-exit-btn').onclick = () => {
            ui.style.opacity = '0';
            setTimeout(() => {
                ui.remove();
                // 従来のOS（CanvasBuilder）の起動処理を呼び出す
                if (window.startUniverseOS) window.startUniverseOS('ADMIN');
            }, 500);
        };
    }
}