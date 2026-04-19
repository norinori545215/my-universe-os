// src/main.js
import { CanvasBuilder } from '../engine/CanvasBuilder.js';
import { CognitiveShield } from '../engine/CognitiveShield.js'; 
import { GlitchEngine } from '../engine/GlitchEngine.js'; 
import { WanderingEntities } from '../ai/WanderingEntities.js';
import { auth, db } from '../security/Auth.js';
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ★ ログインゲートウェイと管理ポータルのインポート
import { LoginGateway } from './security/LoginGateway.js';
import { AdminPortal } from './ui/AdminPortal.js';

// 二重起動を防止するためのフラグ
window.__osStarted = false;

/**
 * OS本体を起動するグローバル関数
 */
window.startUniverseOS = (role) => {
    // 既にOSが起動していたら何もしない（二重描画を防ぐ）
    if (window.__osStarted) return;
    window.__osStarted = true;

    console.log(`マルチバース・エンジン起動... [最終権限: ${role}]`);

    // 宇宙の描画エンジン（CanvasBuilder）を起動
    const app = new CanvasBuilder('universe-canvas'); 
    
    // 防壁やグリッチエフェクト、AIエンティティなどのシステムを起動
    new CognitiveShield(); 
    GlitchEngine.toggleCRT(true); 
    WanderingEntities.start(app); 
};

/**
 * ページ読み込み完了時のエントリーポイント
 */
window.addEventListener('DOMContentLoaded', async () => {
    console.log("システム初期化シーケンス開始...");

    try {
        // ★ ステップ1: ログイン画面（門番）を立ち上げる
        // ここでパスワードや生体認証が終わるまで進行が止まる
        const bootAction = await LoginGateway.boot();

        // ★ ステップ2: 認証結果によって「全く違う画面」をスタートさせる
        if (bootAction === 'ROUTE_ADMIN_PORTAL') {
            // 開発者が「① 招待コード発行画面」を選んだ場合
            console.log("管理者ポータルを展開します...");
            // ポータルを閉じた時に、OS(PRO版)を起動させるようにコールバックを渡す
            AdminPortal.render(() => {
                window.startUniverseOS('ADMIN');
            });
        } else {
            // 既存ユーザー(PRO)、新規ユーザー(RESTRICTED)、特別ゲスト(VIP) は通常通りOSを起動
            window.startUniverseOS(bootAction);
        }
        
    } catch (e) {
        console.error("認証フローが中断・キャンセルされました:", e);
    }
});

/**
 * 全データ消去（ビッグバン）コマンド
 */
window.resetUniverseData = async () => {
    const confirmReset = confirm("本当に宇宙を完全に初期化しますか？\n（クラウドの星もすべて消え去り、元には戻せません！）");
    if (!confirmReset) return;

    try {
        // クラウド（Firebase）のデータを削除
        const user = auth.currentUser;
        if (user) {
            await deleteDoc(doc(db, "universes", user.uid));
            console.log("☁️ クラウドデータを消去しました");
        }

        // ローカルストレージとセッションを完全にクリア
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