import { CanvasBuilder } from '../engine/CanvasBuilder.js';
import { auth, db } from '../security/Auth.js';
import { doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

window.addEventListener('DOMContentLoaded', () => {
    console.log("マルチバース・エンジン起動...");
    new CanvasBuilder('universe-canvas');
});

// ★ どこからでも呼び出せる「完全消去魔法（ビッグバン）」を新設！
window.resetUniverseData = async () => {
    const confirmReset = confirm("本当に宇宙を完全に初期化しますか？\n（クラウドの星もすべて消え去り、元には戻せません！）");
    if (!confirmReset) return;

    try {
        // 1. クラウド(Firebase)のデータを吹き飛ばす！
        const user = auth.currentUser;
        if (user) {
            await deleteDoc(doc(db, "universes", user.uid));
            console.log("☁️ クラウドデータを消去しました");
        }

        // 2. スマホ・PC本体のデータ(古い記憶)も確実に吹き飛ばす！
        localStorage.clear();
        console.log("💻 ローカルデータを消去しました");

        // 3. 画面を強制リロードして、まっさらな宇宙へ！
        alert("宇宙の初期化が完了しました。新たなビッグバンを起こします！");
        window.location.reload();
    } catch (error) {
        console.error("消去エラー:", error);
        alert("データの消去中にエラーが発生しました。");
    }
};