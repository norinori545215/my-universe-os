// src/ui/AdminPortal.js
import { VIPInvite } from '../billing/VIPInvite.js';
import { db, auth } from '../security/Auth.js';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export class AdminPortal {
    static async render(onExitCallback) {
        if (localStorage.getItem('universe_role') !== 'ADMIN') {
            alert("権限がありません。");
            if (onExitCallback) onExitCallback();
            return;
        }

        const ui = document.createElement('div');
        ui.id = 'admin-portal-screen';
        
        // 画面全体を覆う黒い背景
        ui.style.cssText = `position:fixed; top:0; left:0; width:100vw; height:100vh; background:#050508; z-index:9999999; display:flex; color:#fff; font-family:sans-serif;`;
        document.body.appendChild(ui);

        // クラウドから現在の設定を読み込む
        // ★追加：9つの詳細な制限項目をデフォルト値として定義
        let restrictions = { 
            maxNodes: 50, 
            allow3D: false, 
            allowP2P: false,
            allowNodeEdit: false,
            allowNodeColor: false,
            allowNodeShape: false,
            allowNodeImage: false,
            allowNodeLink: false,
            allowNodeDelete: false,
            allowExec: false,
            allowVault: false,
            allowAI: false
        };

        try {
            const settingsDoc = await getDoc(doc(db, "system", "settings"));
            if (settingsDoc.exists() && settingsDoc.data().new_user_limits) {
                restrictions = { ...restrictions, ...settingsDoc.data().new_user_limits };
            }
        } catch (e) {
            console.error("設定の読み込みエラー:", e);
        }

        // --- UIレイアウト構築（サイドバー ＋ メインコンテンツ） ---
        ui.innerHTML = `
            <div style="width:280px; background:#0a0a10; border-right:1px solid #333; display:flex; flex-direction:column; padding:20px; box-sizing:border-box; box-shadow:5px 0 20px rgba(0,0,0,0.5); z-index:2;">
                <div style="font-size:20px; color:#ff00ff; font-weight:bold; letter-spacing:3px; margin-bottom:5px; text-shadow:0 0 10px rgba(255,0,255,0.5);">CREATOR PORTAL</div>
                <div style="color:#888; font-size:11px; margin-bottom:40px;">System Management Console</div>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    <button class="admin-tab-btn active" data-target="tab-vip" style="text-align:left; padding:15px; background:rgba(255,0,255,0.1); border:1px solid #ff00ff; color:#ff00ff; border-radius:8px; cursor:pointer; font-weight:bold; transition:0.2s;">
                        🎟️ VIPコード発行
                    </button>
                    <button class="admin-tab-btn" data-target="tab-limits" style="text-align:left; padding:15px; background:transparent; border:1px solid #333; color:#aaa; border-radius:8px; cursor:pointer; font-weight:bold; transition:0.2s;">
                        ⚙️ ゲスト制限設定
                    </button>
                    <button class="admin-tab-btn" data-target="tab-salvage" style="text-align:left; padding:15px; background:transparent; border:1px solid #333; color:#aaa; border-radius:8px; cursor:pointer; font-weight:bold; transition:0.2s;">
                        🚨 データサルベージ
                    </button>
                </div>

                <div style="flex-grow:1;"></div>
                <button id="portal-exit-btn" style="padding:15px; background:transparent; border:1px solid #666; color:#888; border-radius:8px; cursor:pointer; font-weight:bold; transition:0.2s;">
                    🚪 OSへ戻る
                </button>
            </div>

            <div style="flex:1; padding:40px; overflow-y:auto; background:radial-gradient(circle at center, #111, #050508); position:relative;">
                
                <div id="tab-vip" class="admin-tab-content" style="display:block; max-width:700px;">
                    <h2 style="color:#fff; border-bottom:2px solid #ff00ff; padding-bottom:10px; margin-bottom:30px;">🎟️ 顧客・特別ゲスト招待</h2>
                    <div style="background:rgba(255,0,255,0.05); border:1px solid #ff00ff; border-radius:12px; padding:30px; box-shadow:0 0 30px rgba(255,0,255,0.1);">
                        <label style="display:block; font-size:12px; color:#ff88ff; margin-bottom:8px;">付与する権限</label>
                        <div style="display:flex; gap:10px; margin-bottom:20px;">
                            <label style="flex:1; background:rgba(255,0,255,0.1); border:1px solid #ff00ff; padding:10px; border-radius:6px; cursor:pointer; text-align:center;">
                                <input type="radio" name="portal-tier" value="PRO" checked style="accent-color:#ff00ff;"> PRO版 (無制限)
                            </label>
                        </div>

                        <label style="display:block; font-size:12px; color:#aaa; margin-bottom:8px;">有効日数</label>
                        <input type="number" id="portal-days" value="30" min="1" style="width:100%; background:#111; border:1px solid #555; color:#fff; padding:12px; border-radius:6px; margin-bottom:20px; box-sizing:border-box; outline:none;">
                        
                        <label style="display:block; font-size:12px; color:#aaa; margin-bottom:8px;">宛先メモ (管理用)</label>
                        <input type="text" id="portal-memo" placeholder="例: A社様 トライアル" style="width:100%; background:#111; border:1px solid #555; color:#fff; padding:12px; border-radius:6px; margin-bottom:30px; box-sizing:border-box; outline:none;">
                        
                        <button id="portal-gen-btn" style="width:100%; padding:15px; background:#440044; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:bold; font-size:16px;">VIPコードを錬成</button>
                        
                        <textarea id="portal-code-out" readonly style="width:100%; height:80px; background:#000; color:#00ffcc; border:1px dashed #00ffcc; margin-top:20px; display:none; resize:none; padding:15px; box-sizing:border-box; outline:none; font-family:monospace; font-size:16px; text-align:center; line-height:50px;"></textarea>
                        <button id="portal-copy-btn" style="width:100%; padding:12px; background:#003333; color:#00ffcc; border:1px solid #00ffcc; border-radius:6px; cursor:pointer; font-weight:bold; margin-top:10px; display:none;">📄 コピーして顧客に渡す</button>
                    </div>
                </div>

                <div id="tab-limits" class="admin-tab-content" style="display:none; max-width:800px;">
                    <h2 style="color:#fff; border-bottom:2px solid #00ffcc; padding-bottom:10px; margin-bottom:10px;">⚙️ 新規ユーザー (ゲスト) 制限設定</h2>
                    <p style="color:#aaa; font-size:12px; margin-bottom:30px; line-height:1.6;">ここで設定した内容は、明日以降ログインする全世界の「無料ゲストユーザー」に適用されます。<br>※将来的にユーザーが購入・課金を行い「PRO」権限へ昇格した場合は、これらの制限はすべて自動的に解除されます。</p>

                    <div style="background:rgba(0,255,204,0.05); border:1px solid #00ffcc; border-radius:12px; padding:30px; box-shadow:0 0 30px rgba(0,255,204,0.1);">
                        
                        <h3 style="color:#00ffcc; font-size:14px; margin-top:0; margin-bottom:15px;">■ 基礎制限</h3>
                        <label style="display:block; font-size:12px; color:#aaa; margin-bottom:8px;">星の最大生成数 (個)</label>
                        <input type="number" id="limit-nodes" value="${restrictions.maxNodes}" style="width:100%; background:#111; border:1px solid #555; color:#fff; padding:12px; border-radius:6px; margin-bottom:25px; box-sizing:border-box; outline:none;">
                        
                        <h3 style="color:#00ffcc; font-size:14px; margin-bottom:15px;">■ システム拡張機能</h3>
                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:25px;">
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#1a1a24; padding:12px; border-radius:8px;">
                                <input type="checkbox" id="limit-3d" ${restrictions.allow3D ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> 🪐 3Dエンジン (立体宇宙)
                            </label>
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#1a1a24; padding:12px; border-radius:8px;">
                                <input type="checkbox" id="limit-p2p" ${restrictions.allowP2P ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> 🌐 P2P通信 (ワームホール)
                            </label>
                        </div>

                        <h3 style="color:#00ffcc; font-size:14px; margin-bottom:15px;">■ 星のメニュー機能制限（詳細）</h3>
                        <div style="font-size:11px; color:#888; margin-bottom:10px;">✅チェックを入れた機能のみ、ゲストユーザーにも使用が許可されます。</div>
                        
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-bottom:30px;">
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#1a1a24; padding:12px; border-radius:8px; border-left:3px solid #ccff66;">
                                <input type="checkbox" id="limit-edit" ${restrictions.allowNodeEdit ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> 名前・記憶編集
                            </label>
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#1a1a24; padding:12px; border-radius:8px; border-left:3px solid #00ffcc;">
                                <input type="checkbox" id="limit-color" ${restrictions.allowNodeColor ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> 色の変更
                            </label>
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#1a1a24; padding:12px; border-radius:8px; border-left:3px solid #fff;">
                                <input type="checkbox" id="limit-shape" ${restrictions.allowNodeShape ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> 形の変更
                            </label>

                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#1a1a24; padding:12px; border-radius:8px; border-left:3px solid #ffaa00;">
                                <input type="checkbox" id="limit-image" ${restrictions.allowNodeImage ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> 画像・アイコン設定
                            </label>
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#1a1a24; padding:12px; border-radius:8px; border-left:3px solid #aaaaff;">
                                <input type="checkbox" id="limit-link" ${restrictions.allowNodeLink ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> URLリンク設定
                            </label>
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#1a1a24; padding:12px; border-radius:8px; border-left:3px solid #ff66aa;">
                                <input type="checkbox" id="limit-vault" ${restrictions.allowVault ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> 地下金庫(Vault)操作
                            </label>

                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#2a1a1a; padding:12px; border-radius:8px; border-left:3px solid #ff0000;" title="※ゲストには原則OFFを推奨">
                                <input type="checkbox" id="limit-exec" ${restrictions.allowExec ? 'checked' : ''} style="width:18px; height:18px; accent-color:#ff0000;"> プログラム実行 (危険)
                            </label>
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#2a1a2a; padding:12px; border-radius:8px; border-left:3px solid #ff00ff;">
                                <input type="checkbox" id="limit-ai" ${restrictions.allowAI ? 'checked' : ''} style="width:18px; height:18px; accent-color:#00ffcc;"> AIとの脳波リンク
                            </label>
                            <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-size:13px; background:#2a1a1a; padding:12px; border-radius:8px; border-left:3px solid #ff4444;">
                                <input type="checkbox" id="limit-delete" ${restrictions.allowNodeDelete ? 'checked' : ''} style="width:18px; height:18px; accent-color:#ff4444;"> 星の破壊 (削除)
                            </label>
                        </div>

                        <button id="portal-save-btn" style="width:100%; padding:15px; background:#004444; color:#00ffcc; border:1px solid #00ffcc; border-radius:8px; cursor:pointer; font-weight:bold; font-size:16px;">
                            💾 制限設定をクラウドに保存
                        </button>
                    </div>
                </div>

                <div id="tab-salvage" class="admin-tab-content" style="display:none; max-width:700px;">
                    <h2 style="color:#fff; border-bottom:2px solid #ffcc00; padding-bottom:10px; margin-bottom:10px;">🚨 迷子データのサルベージ</h2>
                    <p style="color:#aaa; font-size:12px; margin-bottom:30px; line-height:1.6;">過去に作成して見えなくなってしまったデータをクラウド全体から探し出し、現在の開発者アカウントに復元（上書き）します。<br>※実行前に、Firebaseのルールが一時的に読み取り許可されていることを確認してください。</p>

                    <div style="background:rgba(255,204,0,0.05); border:1px solid #ffcc00; border-radius:12px; padding:30px; box-shadow:0 0 30px rgba(255,204,0,0.1); text-align:center;">
                        <div style="font-size:40px; margin-bottom:20px;">🛰️</div>
                        <button id="portal-salvage-btn" style="width:100%; padding:15px; background:#332200; color:#ffcc00; border:1px solid #ffcc00; border-radius:8px; cursor:pointer; font-weight:bold; font-size:16px;">
                            クラウドの深淵をスキャンして復元する
                        </button>
                    </div>
                </div>
            </div>
        `;

        // --- タブ切り替えのロジック ---
        const tabBtns = ui.querySelectorAll('.admin-tab-btn');
        const tabContents = ui.querySelectorAll('.admin-tab-content');

        tabBtns.forEach(btn => {
            btn.onclick = () => {
                tabBtns.forEach(b => {
                    b.style.background = 'transparent';
                    b.style.borderColor = '#333';
                    b.style.color = '#aaa';
                    b.classList.remove('active');
                });
                tabContents.forEach(c => c.style.display = 'none');

                btn.style.background = 'rgba(0,255,204,0.1)';
                btn.style.borderColor = '#00ffcc';
                btn.style.color = '#00ffcc';
                
                if(btn.dataset.target === 'tab-vip') {
                    btn.style.background = 'rgba(255,0,255,0.1)';
                    btn.style.borderColor = '#ff00ff';
                    btn.style.color = '#ff00ff';
                }
                if(btn.dataset.target === 'tab-salvage') {
                    btn.style.background = 'rgba(255,204,0,0.1)';
                    btn.style.borderColor = '#ffcc00';
                    btn.style.color = '#ffcc00';
                }

                btn.classList.add('active');
                ui.querySelector(`#${btn.dataset.target}`).style.display = 'block';
            };
        });

        // --- ボタンの機能ロジック ---
        document.getElementById('portal-exit-btn').onclick = () => {
            ui.style.opacity = '0';
            setTimeout(() => {
                ui.remove();
                if (onExitCallback) onExitCallback();
            }, 300);
        };

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

        document.getElementById('portal-save-btn').onclick = async () => {
            const btn = document.getElementById('portal-save-btn');
            btn.innerText = "クラウドへ送信中...";
            btn.disabled = true;

            // ★追加：9つの詳細設定をすべて取得してクラウドへ保存
            const limits = {
                maxNodes: parseInt(document.getElementById('limit-nodes').value) || 50,
                allow3D: document.getElementById('limit-3d').checked,
                allowP2P: document.getElementById('limit-p2p').checked,
                allowNodeEdit: document.getElementById('limit-edit').checked,
                allowNodeColor: document.getElementById('limit-color').checked,
                allowNodeShape: document.getElementById('limit-shape').checked,
                allowNodeImage: document.getElementById('limit-image').checked,
                allowNodeLink: document.getElementById('limit-link').checked,
                allowNodeDelete: document.getElementById('limit-delete').checked,
                allowExec: document.getElementById('limit-exec').checked,
                allowVault: document.getElementById('limit-vault').checked,
                allowAI: document.getElementById('limit-ai').checked
            };

            try {
                await setDoc(doc(db, "system", "settings"), { new_user_limits: limits }, { merge: true });
                alert("✅ 制限設定をクラウドに保存しました！\n明日以降の新規ゲストユーザーに適用されます。");
            } catch (error) {
                alert(`保存エラー: ${error.message}`);
            }

            btn.innerText = "💾 制限設定をクラウドに保存";
            btn.disabled = false;
        };

        document.getElementById('portal-salvage-btn').onclick = async () => {
            const btn = document.getElementById('portal-salvage-btn');
            const origText = btn.innerText;
            btn.innerText = "📡 クラウドの深淵をスキャン中...";
            btn.disabled = true;

            try {
                const querySnapshot = await getDocs(collection(db, "universes"));
                let bestBackup = null;
                let maxLength = 0;

                querySnapshot.forEach((d) => {
                    if (auth.currentUser && d.id !== auth.currentUser.uid) {
                        const data = d.data();
                        if (data && data.encryptedData && data.encryptedData.length > maxLength) {
                            maxLength = data.encryptedData.length;
                            bestBackup = data.encryptedData;
                        }
                    }
                });

                if (bestBackup) {
                    if (confirm("✨ 過去の巨大なデータを発見しました！\n現在の開発者アカウントに引き継いで復元しますか？")) {
                        await setDoc(doc(db, "universes", auth.currentUser.uid), {
                            encryptedData: bestBackup,
                            updatedAt: serverTimestamp()
                        });
                        alert("✅ データの引き継ぎに成功しました！\nOSを再起動して宇宙を読み込みます。");
                        window.location.reload();
                    } else {
                        btn.innerText = origText;
                        btn.disabled = false;
                    }
                } else {
                    alert("クラウド上に復元可能な過去のデータが見つかりませんでした。");
                    btn.innerText = origText;
                    btn.disabled = false;
                }
            } catch (error) {
                console.error(error);
                alert(`スキャンエラー: ${error.message}\nFirebaseのルールが一時的に緩められているか確認してください。`);
                btn.innerText = origText;
                btn.disabled = false;
            }
        };
    }
}