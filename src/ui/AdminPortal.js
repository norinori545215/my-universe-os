// src/ui/AdminPortal.js
import { VIPInvite } from '../billing/VIPInvite.js';
import { db } from '../security/Auth.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class AdminPortal {
    static async render(onExitCallback) {
        // ★ 絶対防壁：開発者(ADMIN)以外がこの画面を呼び出そうとしたら即座に弾く
        if (localStorage.getItem('universe_role') !== 'ADMIN') {
            console.error("ACCESS DENIED: Unauthorized access to Admin Portal.");
            alert("権限がありません。");
            if (onExitCallback) onExitCallback();
            return;
        }

        const ui = document.createElement('div');
        ui.id = 'admin-portal-screen';
        ui.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh; background:#0a0000; z-index:9999999; display:flex; flex-direction:column; align-items:center; padding-top:40px; color:#fff; font-family:monospace; overflow-y:auto;`;
        document.body.appendChild(ui);

        ui.innerHTML = `<div style="color:#00ffcc; font-size:18px; margin-top:20vh;">クラウドデータベースから設定を読み込んでいます...</div>`;

        // ★ クラウドから現在の「新規ユーザー制限設定」を読み込む
        let restrictions = { maxNodes: 50, allow3D: false, allowP2P: false };
        try {
            const settingsDoc = await getDoc(doc(db, "system", "settings"));
            if (settingsDoc.exists() && settingsDoc.data().new_user_limits) {
                restrictions = settingsDoc.data().new_user_limits;
            }
        } catch (e) {
            console.error("設定の読み込みエラー:", e);
        }

        ui.innerHTML = `
            <div style="text-align:center; margin-bottom:30px;">
                <div style="font-size:24px; color:#ff4444; font-weight:bold; letter-spacing:5px;">👁️ CREATOR PORTAL</div>
                <div style="color:#aaa; font-size:12px; margin-top:5px;">クラウド直結・権限管理システム</div>
            </div>

            <div style="display:flex; gap:20px; width:90%; max-width:800px; flex-wrap:wrap; justify-content:center;">
                
                <div style="flex:1; min-width:320px; background:rgba(255,0,0,0.05); border:1px solid #ff4444; border-radius:12px; padding:20px; box-shadow:0 0 30px rgba(255,0,0,0.2);">
                    <div style="color:#ff8888; font-weight:bold; border-bottom:1px solid #ff4444; padding-bottom:10px; margin-bottom:15px;">🎟️ 顧客・特別ゲスト用 (VIPコード発行)</div>
                    
                    <div style="margin-bottom: 15px;">
                        <label style="display:block; font-size:11px; color:#ff8888; margin-bottom:8px;">付与する権限</label>
                        <div style="display:flex; gap:10px;">
                            <label style="flex:1; background:rgba(255,0,0,0.1); border:1px solid #ff4444; padding:8px; border-radius:6px; cursor:pointer; text-align:center;">
                                <input type="radio" name="portal-tier" value="PRO" checked style="accent-color:#ff4444;"> PRO版 (無制限)
                            </label>
                        </div>
                    </div>

                    <label style="display:block; font-size:11px; color:#ffaa00; margin-bottom:5px;">有効日数 (1日〜何百年でも)</label>
                    <input type="number" id="portal-days" value="30" min="1" style="width:100%; background:#110000; border:1px solid #ff4444; color:#fff; padding:10px; border-radius:6px; margin-bottom:15px; box-sizing:border-box; outline:none;">
                    
                    <label style="display:block; font-size:11px; color:#ffaa00; margin-bottom:5px;">宛先メモ (管理用)</label>
                    <input type="text" id="portal-memo" placeholder="例: A社様 トライアル" style="width:100%; background:#110000; border:1px solid #ff4444; color:#fff; padding:10px; border-radius:6px; margin-bottom:20px; box-sizing:border-box; outline:none;">
                    
                    <button id="portal-gen-btn" style="width:100%; padding:15px; background:#440000; color:#fff; border:none; border-radius:6px; cursor:pointer; font-weight:bold;">VIPコードをランダム錬成</button>
                    
                    <textarea id="portal-code-out" readonly style="width:100%; height:60px; background:#000; color:#00ffcc; border:1px dashed #00ffcc; margin-top:15px; display:none; resize:none; padding:10px; box-sizing:border-box; outline:none;"></textarea>
                    <button id="portal-copy-btn" style="width:100%; padding:10px; background:#003333; color:#00ffcc; border:1px solid #00ffcc; border-radius:4px; cursor:pointer; font-weight:bold; margin-top:10px; display:none;">📄 コピーして顧客に渡す</button>
                </div>

                <div style="flex:1; min-width:320px; background:rgba(0,255,204,0.05); border:1px solid #00ffcc; border-radius:12px; padding:20px; box-shadow:0 0 30px rgba(0,255,204,0.2);">
                    <div style="color:#00ffcc; font-weight:bold; border-bottom:1px solid #00ffcc; padding-bottom:10px; margin-bottom:15px;">⚙️ 新規ユーザー (ゲスト) の制限設定</div>
                    <div style="font-size:10px; color:#aaa; margin-bottom:20px; line-height:1.5;">※明日以降ログインする全世界の新規ユーザーに【クラウド経由】で適用されます。</div>
                    
                    <label style="display:block; font-size:11px; color:#00ffcc; margin-bottom:8px;">星の最大生成数</label>
                    <input type="number" id="limit-nodes" value="${restrictions.maxNodes}" style="width:100%; background:#001111; border:1px solid #00ffcc; color:#fff; padding:10px; border-radius:6px; margin-bottom:20px; box-sizing:border-box; outline:none;">
                    
                    <label style="display:flex; align-items:center; gap:10px; margin-bottom:15px; cursor:pointer; font-size:14px;">
                        <input type="checkbox" id="limit-3d" ${restrictions.allow3D ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> 3Dエンジンを許可する
                    </label>
                    
                    <label style="display:flex; align-items:center; gap:10px; margin-bottom:30px; cursor:pointer; font-size:14px;">
                        <input type="checkbox" id="limit-p2p" ${restrictions.allowP2P ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> P2P通信(ワームホール)を許可する
                    </label>

                    <button id="portal-save-btn" style="width:100%; padding:15px; background:#003333; color:#00ffcc; border:1px solid #00ffcc; border-radius:8px; cursor:pointer; font-weight:bold; font-size:14px;">
                        💾 制限設定をクラウドに保存
                    </button>
                </div>
            </div>

            <button id="portal-exit-btn" style="margin-top:30px; padding:15px 40px; background:transparent; border:1px solid #888; color:#888; border-radius:30px; cursor:pointer; font-weight:bold;">
                設定を終えてOS画面へ進む
            </button>
        `;

        // ★ ここを正しく portal-gen-btn に修正しました！
        document.getElementById('portal-gen-btn').onclick = async () => {
            const tier = document.querySelector('input[name="portal-tier"]:checked').value;
            const days = parseInt(document.getElementById('portal-days').value) || 30;
            const memo = document.getElementById('portal-memo').value || "No Name";
            
            const code = await VIPInvite.generateTicket(tier, days, memo);
            
            const out = document.getElementById('portal-code-out');
            out.value = code;
            out.style.display = 'block';
            document.getElementById('portal-copy-btn').style.display = 'block';
        };

        document.getElementById('portal-copy-btn').onclick = (e) => {
            const outArea = document.getElementById('portal-code-out');
            outArea.select();
            document.execCommand('copy');
            e.target.innerText = "✅ コピー完了";
            setTimeout(() => e.target.innerText = "📄 コピーして顧客に渡す", 2000);
        };

        // 設定をクラウドデータベース（Firestore）に保存する
        document.getElementById('portal-save-btn').onclick = async () => {
            const btn = document.getElementById('portal-save-btn');
            btn.innerText = "保存中...";
            btn.disabled = true;

            const limits = {
                maxNodes: parseInt(document.getElementById('limit-nodes').value) || 50,
                allow3D: document.getElementById('limit-3d').checked,
                allowP2P: document.getElementById('limit-p2p').checked
            };

            try {
                await setDoc(doc(db, "system", "settings"), { new_user_limits: limits }, { merge: true });
                alert("クラウドへの保存が完了しました！\n今後すべての新規ユーザーにこの制限が適用されます。");
            } catch (error) {
                alert(`保存エラー: ${error.message}\nFirestoreのセキュリティルールを確認してください。`);
            }

            btn.innerText = "💾 制限設定をクラウドに保存";
            btn.disabled = false;
        };

        document.getElementById('portal-exit-btn').onclick = () => {
            ui.style.opacity = '0';
            setTimeout(() => {
                ui.remove();
                if (onExitCallback) onExitCallback();
            }, 500);
        };
    }
}