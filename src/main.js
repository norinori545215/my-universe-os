// src/main.js
import { CanvasBuilder } from './engine/CanvasBuilder.js';
import { CognitiveShield } from './engine/CognitiveShield.js'; 
import { GlitchEngine } from './engine/GlitchEngine.js'; 
import { WanderingEntities } from './ai/WanderingEntities.js';
import { auth, db } from './security/Auth.js';
import { doc, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ★ インポート
import { LoginGateway } from './security/LoginGateway.js';
import { AdminPortal } from './ui/AdminPortal.js';

window.__osStarted = false;

window.startUniverseOS = (role) => {
    if (window.__osStarted) return;
    window.__osStarted = true;

    console.log(`マルチバース・エンジン起動... [最終権限: ${role}]`);
    localStorage.setItem('universe_role', role);

    const app = new CanvasBuilder('universe-canvas'); 
    
    new CognitiveShield(); 
    GlitchEngine.toggleCRT(false); 
    WanderingEntities.start(app); 
};

window.addEventListener('DOMContentLoaded', async () => {
    console.log("システム初期化シーケンス開始...");

    try {
        const bootAction = await LoginGateway.boot();

        if (bootAction === 'ROUTE_ADMIN_PORTAL') {
            console.log("管理者ポータルを展開します...");
            AdminPortal.render(() => {
                window.startUniverseOS('ADMIN');
            });
        } else {
            window.startUniverseOS(bootAction);
        }
        
    } catch (e) {
        console.error("認証フローが中断・キャンセルされました:", e);
    }
});

window.resetUniverseData = async () => {
    const confirmReset = confirm("本当に宇宙を完全に初期化しますか？\n（クラウドの星もすべて消え去り、元には戻せません！）");
    if (!confirmReset) return;

    try {
        const user = auth.currentUser;
        if (user) {
            await deleteDoc(doc(db, "universes", user.uid));
            console.log("☁️ クラウドデータを消去しました");
        }

        localStorage.clear();
        sessionStorage.clear();
        console.log("💻 ローカルデータを消去しました");

        alert("宇宙の初期化が完了しました。新たなビッグバンを起こします！");
        window.location.reload();
    } catch (error) {
        console.error("消去エラー:", error);
        alert("データの消去中にエラーが発生しました。");
    }
};

// =========================================================================
// ★ データ復旧ツール：過去のローカルバックアップからクラウドへデータを強制移植する
// =========================================================================
window.rescueLostData = async () => {
    const backupData = localStorage.getItem('universe_backup_before_wipe') || localStorage.getItem('my_universe_save_data');
    
    if (!backupData) {
        alert("⚠️ ローカルに復旧可能なデータ（バックアップ）が見つかりませんでした。\nすでに別の端末やブラウザに移動してしまった可能性があります。");
        return;
    }

    if (confirm("ローカルに残っている過去のデータを、現在の開発者アカウントに強制移植（上書き復元）しますか？")) {
        try {
            const parsedData = JSON.parse(backupData);
            const user = auth.currentUser;
            
            if (!user) {
                alert("⚠️ ログインしていません。開発者アカウントでログインしてから実行してください。");
                return;
            }

            // クラウド上のデータを過去のバックアップで上書き
            await setDoc(doc(db, "universes", user.uid), {
                encryptedData: backupData,
                updatedAt: new Date().toISOString()
            });

            // 現在のセッションデータも書き換え
            sessionStorage.setItem('my_universe_save_data', backupData);
            
            alert("✅ データの復旧（移植）に成功しました！\nOSを再起動します。");
            window.location.reload();
            
        } catch (e) {
            alert(`🚨 復旧エラー: ${e.message}`);
        }
    }
};