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
    console.log("システム初期化...");

    // ★ ここでログイン画面を立ち上げ、ユーザーが認証を突破するまで進行を止める
    try {
        const userRole = await LoginGateway.boot();
        console.log(`[ACCESS GRANTED] 権限: ${userRole}`);
    } catch (e) {
        console.error("認証キャンセル", e);
        return; // 認証に失敗したらOSは起動させない
    }

    // --- 認証突破後、はじめてOS（宇宙）を描画する ---
    console.log("マルチバース・エンジン起動...");
    
    const app = new CanvasBuilder('universe-canvas'); 
    
    new CognitiveShield(); 
    GlitchEngine.toggleCRT(true); 
    
    WanderingEntities.start(app); 
});

window.resetUniverseData = async () => {
    const confirmReset = confirm("本当に宇宙を完全に初期化しますか？\n（クラウドの星もすべて消え去り、元には戻せません！）");
    if (!confirmReset) return;

    try {
        const user = auth.currentUser;
        if (user) {
            await deleteDoc(doc(db, "universes", user.uid));
        }

        localStorage.clear();
        alert("宇宙の初期化が完了しました。新たなビッグバンを起こします！");
        window.location.reload();
    } catch (error) {
        console.error("消去エラー:", error);
        alert("データの消去中にエラーが発生しました。");
    }
};