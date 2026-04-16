// src/main.js
import { CanvasBuilder } from '../engine/CanvasBuilder.js';
import { CognitiveShield } from '../engine/CognitiveShield.js'; 
import { GlitchEngine } from '../engine/GlitchEngine.js'; 
import { WanderingEntities } from '../ai/WanderingEntities.js';
import { auth, db } from '../security/Auth.js';
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ★ 追加：ログインゲートウェイ
import { LoginGateway } from './security/LoginGateway.js';

window.addEventListener('DOMContentLoaded', async () => {
    console.log("マルチバース・システム初期化...");

    // ★ ステップ1：ログインゲートウェイを起動して認証を待つ
    try {
        // ここでパスワード＆生体認証のUIが立ち上がり、成功するまで進行が止まる
        const userRole = await LoginGateway.boot();
        console.log(`[ACCESS GRANTED] Role: ${userRole}`);
    } catch (e) {
        console.error("認証フローが中断されました", e);
        return; // 認証失敗・キャンセルの場合は起動させない
    }

    // ★ ステップ2：認証成功後、OSエンジンを起動する
    console.log("マルチバース・エンジン起動...");
    
    // new CanvasBuilder を変数 app に格納
    const app = new CanvasBuilder('universe-canvas'); 
    
    new CognitiveShield(); 
    GlitchEngine.toggleCRT(true); 
    
    // バックグラウンドでAIエンティティの思考ループを開始
    WanderingEntities.start(app); 
});

// ★ どこからでも呼び出せる「完全消去魔法（ビッグバン）」
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
        console.log("💻 ローカルデータを消去しました");

        alert("宇宙の初期化が完了しました。新たなビッグバンを起こします！");
        window.location.reload();
    } catch (error) {
        console.error("消去エラー:", error);
        alert("データの消去中にエラーが発生しました。");
    }
};