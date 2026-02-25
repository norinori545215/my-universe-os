// src/db/CloudSync.js

/**
 * ☁️ My Universe OS - ゼロ知識クラウド同期 & 地下金庫 (ハイブリッド版)
 * Firebaseに保存する直前にデータを暗号化し、クラウドとローカルの両方に保管。
 * 圏外時は自動的に地下金庫（LocalVault）から宇宙を展開する。
 */

import { auth, db } from '../security/Auth.js';
import { doc, setDoc, getDocFromServer } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { encryptUniverseData, decryptUniverseData } from '../security/CryptoCore.js';
// ★ 地下金庫をインポート
import { LocalVault } from './LocalVault.js';

// 📦 宇宙のデータを暗号化してFirebaseと地下金庫へ保存する
export async function saveEncryptedUniverse(universeData) {
    if (!auth.currentUser || !window.universeCryptoKey) return false;

    try {
        // 1. データを「意味不明な暗号カプセル」に変換！
        const encryptedCapsule = await encryptUniverseData(universeData, window.universeCryptoKey);
        
        // ★ 2. まずはオフライン用に「地下金庫(LocalVault)」へ即座に保存！
        await LocalVault.save(encryptedCapsule);

        // 3. カプセルだけをFirebaseに送信（Googleには中身は絶対に見えない）
        const userRef = doc(db, "universes", auth.currentUser.uid);
        await setDoc(userRef, {
            encryptedData: encryptedCapsule.cipher,
            iv: encryptedCapsule.iv,
            updatedAt: new Date().toISOString()
        });
        
        console.log("🔒 宇宙を暗号化してクラウドと地下金庫に保存しました。");
        return true;
    } catch (error) {
        console.warn("⚠️ クラウド保存に失敗しましたが、地下金庫には保存されている可能性があります:", error);
        return false;
    }
}

// 🌌 Firebase(または地下金庫)から暗号カプセルを取り出し、ローカルで復元する
export async function loadEncryptedUniverse() {
    if (!auth.currentUser || !window.universeCryptoKey) return null;

    let capsule = null;

    try {
        const userRef = doc(db, "universes", auth.currentUser.uid);
        
        // 1. まずクラウドの最新情報を確認しにいく（サボり防止の getDocFromServer）
        const docSnap = await getDocFromServer(userRef);
        
        if (docSnap.exists() && docSnap.data().encryptedData) {
            capsule = {
                cipher: docSnap.data().encryptedData,
                iv: docSnap.data().iv
            };
            // クラウドから最新データが取れたら、地下金庫も最新にアップデートしておく！
            await LocalVault.save(capsule);
            console.log("☁️ クラウドから暗号カプセルを取得しました。");
        }
    } catch (error) {
        console.warn("📡 クラウドに接続できません（圏外）。地下金庫からの展開に切り替えます...");
    }

    // 2. クラウドがダメ（圏外）だった場合は、地下金庫からカプセルを取り出す
    if (!capsule) {
        capsule = await LocalVault.load();
        if (capsule) {
            console.log("📦 地下金庫から暗号カプセルを発見しました！");
        }
    }

    // 3. カプセルが見つかっていれば、マスターキーを使って解読！
    if (capsule) {
        try {
            const decryptedData = await decryptUniverseData(capsule, window.universeCryptoKey);
            console.log("🔓 宇宙の解読に成功しました。");
            return decryptedData;
        } catch (error) {
            console.error("⚠️ 復号ロード失敗:", error);
            throw new Error("Decryption failed");
        }
    }
    
    return null; // どこにもデータがない場合（初回起動時）
}