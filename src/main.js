// src/main.js
import { CanvasBuilder } from '../engine/CanvasBuilder.js';
import { CognitiveShield } from '../engine/CognitiveShield.js'; 
import { GlitchEngine } from '../engine/GlitchEngine.js'; 
import { WanderingEntities } from '../ai/WanderingEntities.js';
import { auth, db } from '../security/Auth.js';
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ★ ログインゲートウェイのインポート
import { LoginGateway } from './security/LoginGateway.js';

// 二重起動を防止するためのフラグ
window.__osStarted = false;

/**
 * OS本体を起動するグローバル関数
 * （LoginGateway や AdminPortal 等、どこからでも安全に呼び出せるように設計）
 */
window.startUniverseOS = (role) => {
    // 既にOSが起動していたら何もしない（二重描画を防ぐ）
    if (window.__osStarted) return;
    window.__osStarted = true;

    console.log(`マルチバース・エンジン起動... [最終権限: ${role}]`);

    // 権限の最終適用
    localStorage.setItem('universe_role', role);

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
        // ユーザーがパスワードや生体認証を突破するまでここで進行が完全に止まる
        const userRole = await LoginGateway.boot();

        // ★ ステップ2: 認証を突破した場合、OSを起動する
        // ただし、開発者が「チケット発行ポータル」を選択した場合は
        // userRole が 'ADMIN_PORTAL_OPENED' 等になる想定なので起動をスキップする
        if (!window.__osStarted && userRole && userRole !== 'ADMIN_PORTAL_OPENED') {
            window.startUniverseOS(userRole);
        }
        
    } catch (e) {
        // 認証に失敗、またはユーザーがキャンセルした場合
        console.error("認証フローが中断・キャンセルされました:", e);
        // OSは起動させず、真っ暗な画面のまま待機する
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