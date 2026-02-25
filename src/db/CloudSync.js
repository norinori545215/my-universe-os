// src/db/CloudSync.js
import { auth, db } from '../security/Auth.js';
import { doc, setDoc, getDocFromServer } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { encryptUniverseData, decryptUniverseData } from '../security/CryptoCore.js';
import { LocalVault } from './LocalVault.js';

export async function saveEncryptedUniverse(universeData) {
    if (!window.universeCryptoKey) return false;

    try {
        const encryptedCapsule = await encryptUniverseData(universeData, window.universeCryptoKey);
        
        // ① 圏外でも関係なく、まずは地下金庫へ保存！
        await LocalVault.save(encryptedCapsule);

        // ② もしログインしていてネットに繋がっていればクラウドにも送る
        if (auth && auth.currentUser) {
            const userRef = doc(db, "universes", auth.currentUser.uid);
            await setDoc(userRef, {
                encryptedData: encryptedCapsule.cipher,
                iv: encryptedCapsule.iv,
                updatedAt: new Date().toISOString()
            });
            console.log("🔒 クラウドと地下金庫に保存しました。");
        } else {
            console.log("🔒 圏外モード：地下金庫のみに保存しました。");
        }
        return true;
    } catch (error) {
        console.warn("⚠️ クラウド保存に失敗しましたが、地下金庫には保存されています:", error);
        return false;
    }
}

export async function loadEncryptedUniverse() {
    if (!window.universeCryptoKey) return null;

    let capsule = null;

    // ① ログインしていればクラウドから取得を試みる
    if (auth && auth.currentUser) {
        try {
            const userRef = doc(db, "universes", auth.currentUser.uid);
            const docSnap = await getDocFromServer(userRef);
            
            if (docSnap.exists() && docSnap.data().encryptedData) {
                capsule = {
                    cipher: docSnap.data().encryptedData,
                    iv: docSnap.data().iv
                };
                await LocalVault.save(capsule); // ついでに地下金庫も最新化
                console.log("☁️ クラウドから暗号カプセルを取得しました。");
            }
        } catch (error) {
            console.warn("📡 クラウドに接続できません。地下金庫からの展開に切り替えます...");
        }
    }

    // ② 圏外（または未ログイン）の場合は、地下金庫からカプセルを取り出す
    if (!capsule) {
        capsule = await LocalVault.load();
        if (capsule) {
            console.log("📦 地下金庫から暗号カプセルを発見しました！");
        }
    }

    // ③ マスターキーを使って解読！
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
    
    return null; 
}