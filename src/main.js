// src/main.js
import { CanvasBuilder } from '../engine/CanvasBuilder.js';
import { CognitiveShield } from '../engine/CognitiveShield.js'; 
import { GlitchEngine } from '../engine/GlitchEngine.js'; // ★ 追加：グリッチエンジン
import { auth, db } from '../security/Auth.js';
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

window.addEventListener('DOMContentLoaded', () => {
    console.log("マルチバース・エンジン起動...");
    new CanvasBuilder('universe-canvas');
    new CognitiveShield(); 
    
    // ★ 常にブラウン管（CRT）モニター風の走査線を描画してサイバー感を底上げする
    GlitchEngine.toggleCRT(true); 
});

// ★ どこからでも呼び出せる「完全消去魔法（ビッグバン）」を新設！
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