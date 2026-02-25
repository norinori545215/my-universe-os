// src/db/CloudSync.js

/**
 * ☁️ My Universe OS - ゼロ知識クラウド同期 (CloudSync)
 * Firebaseに保存する直前にデータを暗号化し、読み込む直後に復号する。
 * Googleのサーバーには「暗号カプセル」しか送らないため、絶対的なプライバシーが守られる。
 */

import { auth, db } from '../security/Auth.js';
// ★ 修正点：getDoc を getDocFromServer に変更！（スマホのサボり癖を直すため）
import { doc, setDoc, getDocFromServer } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { encryptUniverseData, decryptUniverseData } from '../security/CryptoCore.js';

// 📦 宇宙のデータを暗号化してFirebaseへ保存する
export async function saveEncryptedUniverse(universeData) {
    // ログインしていない、またはマスターキー（暗号鍵）がない場合は保存しない
    if (!auth.currentUser || !window.universeCryptoKey) return false;

    try {
        // 1. データを「意味不明な暗号カプセル」に変換！
        const encryptedCapsule = await encryptUniverseData(universeData, window.universeCryptoKey);
        
        // 2. カプセルだけをFirebaseに送信（Googleには中身は絶対に見えない）
        const userRef = doc(db, "universes", auth.currentUser.uid);
        await setDoc(userRef, {
            encryptedData: encryptedCapsule.cipher,
            iv: encryptedCapsule.iv, // 復号に必要な初期化ベクトル
            updatedAt: new Date().toISOString()
        });
        
        console.log("🔒 宇宙を暗号化して亜空間（クラウド）へ保存しました。");
        return true;
    } catch (error) {
        console.error("⚠️ 暗号化セーブ失敗:", error);
        return false;
    }
}

// 🌌 Firebaseから暗号カプセルを取り出し、ローカルで復元する
export async function loadEncryptedUniverse() {
    if (!auth.currentUser || !window.universeCryptoKey) return null;

    try {
        const userRef = doc(db, "universes", auth.currentUser.uid);
        
        // ★ ここが超重要！スマホの古いキャッシュを無視し、強制的に最新のクラウドを確認させる！
        const docSnap = await getDocFromServer(userRef);
        
        // Firebaseにデータが存在し、かつ暗号化データがある場合
        if (docSnap.exists() && docSnap.data().encryptedData) {
            const capsule = {
                cipher: docSnap.data().encryptedData,
                iv: docSnap.data().iv
            };
            
            // 3. 端末内（ローカル）で、マスターキーを使ってカプセルを解読！
            const decryptedData = await decryptUniverseData(capsule, window.universeCryptoKey);
            console.log("🔓 宇宙の解読に成功しました。");
            return decryptedData;
        }
        
        return null; // まだ宇宙が創世されていない（初回ログイン時）
    } catch (error) {
        console.error("⚠️ 復号ロード失敗:", error);
        // パスワードが違う場合、ここでエラーが弾けます（門番に知らせるためにエラーを投げる）
        throw new Error("Decryption failed");
    }
}