// src/ui/AdminPortal.js
import { VIPInvite } from '../billing/VIPInvite.js';

export class AdminPortal {
    static render(onExitCallback) {
        // 既存の画面を覆い隠す完全独立の全画面UI
        const ui = document.createElement('div');
        ui.id = 'admin-portal-screen';
        ui.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: #0a0000; z-index: 9999999; display: flex; flex-direction: column;
            align-items: center; padding-top: 40px; color: #fff; font-family: monospace;
            overflow-y: auto;
        `;

        // 保存されている新規ユーザー用の制限データを読み込む（なければデフォルト値）
        const restrictions = JSON.parse(localStorage.getItem('universe_new_user_limits') || '{"maxNodes":50, "allow3D":false, "allowP2P":false}');

        ui.innerHTML = `
            <div style="text-align:center; margin-bottom:30px;">
                <div style="font-size:24px; color:#ff4444; font-weight:bold; letter-spacing:5px;">👁️ CREATOR PORTAL</div>
                <div style="color:#aaa; font-size:12px; margin-top:5px;">招待コード発行 ＆ ゲスト制限管理システム</div>
            </div>

            <div style="display:flex; gap:20px; width:90%; max-width:800px; flex-wrap:wrap; justify-content:center;">
                
                <div style="flex:1; min-width:320px; background:rgba(255,0,0,0.05); border:1px solid #ff4444; border-radius:12px; padding:20px; box-shadow:0 0 30px rgba(255,0,0,0.2);">
                    <div style="color:#ff8888; font-weight:bold; border-bottom:1px solid #ff4444; padding-bottom:10px; margin-bottom:15px;">🎟️ 顧客・特別ゲスト用 (VIPコード発行)</div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; font-size:11px; color:#ff8888; margin-bottom:8px;">付与する権限</label>
                        <div style="display:flex; gap:10px;">
                            <label style="flex:1; background:rgba(255,0,0,0.1); border:1px solid #ff4444; padding:8px; border-radius:6px; cursor:pointer; text-align:center;">
                                <input type="radio" name="portal-tier" value="PRO" checked style="accent-color:#ff4444;"> PRO版
                            </label>
                        </div>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display:block; font-size:11px; color:#ff8888; margin-bottom:8px;">有効日数 (1日〜何百年でも設定可能)</label>
                        <input type="number" id="portal-days" value="30" min="1" style="width:100%; background:#110000; border:1px solid #ff4444; color:#fff; padding:10px; border-radius:6px; outline:none; font-size:14px; box-sizing:border-box;">
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display:block; font-size:11px; color:#ff8888; margin-bottom:8px;">宛先・メモ (誰に渡すコードか)</label>
                        <input type="text" id="portal-memo" placeholder="例: A社様 トライアル用" style="width:100%; background:#110000; border:1px solid #ff4444; color:#fff; padding:10px; border-radius:6px; outline:none; box-sizing:border-box;">
                    </div>

                    <button id="portal-generate-btn" style="width:100%; padding:15px; background:#440000; color:#ff4444; border:1px solid #ff0000; border-radius:8px; font-weight:bold; cursor:pointer; font-size:14px; transition:0.2s;">
                        🩸 ランダムコードを錬成する
                    </button>

                    <div id="portal-result" style="display:none; margin-top:20px; background:#000; padding:15px; border-radius:8px; border:1px dashed #00ffcc;">
                        <div style="font-size:11px; color:#00ffcc; margin-bottom:5px;">生成されたVIPコード:</div>
                        <textarea id="portal-code-output" readonly style="width:100%; height:60px; background:transparent; color:#00ffcc; border:none; resize:none; font-size:11px; outline:none;"></textarea>
                        <button id="portal-copy-btn" style="width:100%; padding:10px; background:#003333; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; cursor:pointer; font-weight:bold; margin-top:10px;">📄 コピーして顧客に渡す</button>
                    </div>
                </div>

                <div style="flex:1; min-width:320px; background:rgba(0,255,204,0.05); border:1px solid #00ffcc; border-radius:12px; padding:20px; box-shadow:0 0 30px rgba(0,255,204,0.2);">
                    <div style="color:#00ffcc; font-weight:bold; border-bottom:1px solid #00ffcc; padding-bottom:10px; margin-bottom:15px;">⚙️ 新規ユーザー (ゲスト) の制限設定</div>
                    <div style="font-size:10px; color:#aaa; margin-bottom:20px; line-height:1.5;">※明日以降、通常ログインしてきた新規ユーザー全員に適用される制限です。</div>
                    
                    <label style="display:block; font-size:11px; color:#00ffcc; margin-bottom:8px;">星の最大生成数</label>
                    <input type="number" id="limit-nodes" value="${restrictions.maxNodes}" style="width:100%; background:#001111; border:1px solid #00ffcc; color:#fff; padding:10px; border-radius:6px; margin-bottom:20px; box-sizing:border-box; outline:none;">
                    
                    <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; cursor:pointer; font-size:14px;">
                        <input type="checkbox" id="limit-3d" ${restrictions.allow3D ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> 3Dエンジンを許可する
                    </label>
                    
                    <label style="display:flex; align-items:center; gap:10px; margin-bottom:30px; cursor:pointer; font-size:14px;">
                        <input type="checkbox" id="limit-p2p" ${restrictions.allowP2P ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> P2P通信(ワームホール)を許可する
                    </label>

                    <button id="portal-save-btn" style="width:100%; padding:15px; background:#003333; color:#00ffcc; border:1px solid #00ffcc; border-radius:8px; cursor:pointer; font-weight:bold; font-size:14px;">
                        💾 新規ユーザーの設定を保存
                    </button>
                </div>
            </div>

            <button id="portal-exit-btn" style="margin-top:30px; padding:15px 40px; background:transparent; border:1px solid #888; color:#888; border-radius:30px; cursor:pointer; font-weight:bold;">
                設定を終えてOS画面へ進む
            </button>
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
            const outArea = document.getElementById('portal-code-output');
            outArea.select();
            document.execCommand('copy');
            e.target.innerText = "✅ コピー完了";
            setTimeout(() => e.target.innerText = "📄 コピーして顧客に渡す", 2000);
        };

        // 新規ユーザー制限保存イベント
        document.getElementById('portal-save-btn').onclick = () => {
            const limits = {
                maxNodes: parseInt(document.getElementById('limit-nodes').value) || 50,
                allow3D: document.getElementById('limit-3d').checked,
                allowP2P: document.getElementById('limit-p2p').checked
            };
            localStorage.setItem('universe_new_user_limits', JSON.stringify(limits));
            alert("新規ユーザーの制限を更新しました！");
            if (window.universeAudio) window.universeAudio.playSystemSound(600, 'sine', 0.2);
        };

        // OS画面へ抜けるイベント
        document.getElementById('portal-exit-btn').onclick = () => {
            ui.style.opacity = '0';
            setTimeout(() => {
                ui.remove();
                if (onExitCallback) onExitCallback();
            }, 500);
        };
    }
}