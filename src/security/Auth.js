// src/security/Auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    setPersistence, browserLocalPersistence, browserSessionPersistence,
    signOut, updateProfile, sendEmailVerification,
    GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDjr1e3AYjQ7ZGqagb23HWqMdGjZaYcAmU",
  authDomain: "my-universe-os.firebaseapp.com",
  projectId: "my-universe-os",
  storageBucket: "my-universe-os.firebasestorage.app",
  messagingSenderId: "190319305708",
  appId: "1:190319305708:web:0dd89920ad6b9e2f1416c9",
  measurementId: "G-VGBNGHQZWD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// ユーザープロフィール保存（プラン管理の土台）
async function saveUserProfile(user, userName) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            name: userName || user.displayName || "名無し",
            email: user.email,
            plan: "free", 
            createdAt: new Date().toISOString()
        });
    }
}

// 🟡 Googleログイン（アカウント選択機能付き）
export async function loginWithGoogle(rememberMe) {
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        const result = await signInWithPopup(auth, googleProvider);
        
        try {
            await saveUserProfile(result.user, result.user.displayName);
        } catch (e) {
            console.warn("プロフィール保存スキップ:", e.message);
        }
        
        return { success: true, user: result.user };
    } catch (error) {
        return { success: false, error: "Googleログインが中断されました。" };
    }
}

// 🔵 ログイン処理（救済機能：未認証ならメール再送）
export async function loginToUniverse(email, password, rememberMe) {
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        
        // ★救済：パスワードは合っているが、メール未確認の場合
        if (!userCredential.user.emailVerified) {
            await sendEmailVerification(userCredential.user); // 確認メールを再送
            await signOut(auth);
            return { success: false, error: "⚠️ メール確認が完了していません。\n今、確認メールを「再送」しました。受信トレイ（または迷惑メールフォルダ）を確認してください。" };
        }
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: "ログイン失敗。アドレスかパスワードが違います。" };
    }
}

// 🟢 新規登録処理（真犯人逮捕版！）
export async function createUniverseAccount(email, password, userName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: userName });
        
        // ★ここが原因でした！Firestoreの権限エラーで止まらないようにtry-catchで守ります
        try {
            await saveUserProfile(user, userName);
        } catch (dbError) {
            console.warn("⚠️ Firestoreへのプロフィール保存に失敗しましたが、アカウント作成は続行します:", dbError.message);
        }

        // ★エラーで止まらなくなったので、無事に確認メールが送信されます！
        await sendEmailVerification(user);
        await signOut(auth);
        return { success: true };
    } catch (error) {
        let msg = "エラーが発生しました。";
        if (error.code === 'auth/email-already-in-use') {
            msg = "このメールアドレスは既に登録されています！\n「ログイン」に切り替えて進んでください。未確認の場合はメールが再送されます。";
        } else if (error.code === 'auth/invalid-email') {
            msg = "アドレスの形式が正しくありません。";
        } else if (error.code === 'auth/weak-password') {
            msg = "パスワードは6文字以上にしてください。";
        } else {
            // ★予想外のエラーは英語のまま出力して原因を追及可能にする
            msg = `システムエラー: ${error.code} - ${error.message}`;
        }
        return { success: false, error: msg };
    }
}

export async function logoutFromUniverse() {
    await signOut(auth);
}