// src/security/Auth.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword,
    setPersistence,
    browserLocalPersistence,
    browserSessionPersistence,
    signOut,
    updateProfile,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// 🔵 ログイン処理（ログイン維持 ＆ メール確認チェック）
export async function loginToUniverse(email, password, rememberMe) {
    try {
        // rememberMeがtrueなら次回も自動ログイン、falseならブラウザを閉じたらログアウト
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        // ★ 本物のメールアドレスかチェック（確認リンクを踏んでいないと弾く）
        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            return { success: false, error: "メールの確認が完了していません。\n受信トレイのリンクをクリックしてください。" };
        }

        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: "ログインに失敗しました。アドレスかパスワードが違います。" };
    }
}

// 🟢 新規登録処理（アカウント名登録 ＆ 確認メール送信）
export async function createUniverseAccount(email, password, userName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // アカウント名（表示名）をFirebaseに保存
        await updateProfile(user, { displayName: userName });

        // ★ 登録したアドレス宛に「本物の確認メール」を送信
        await sendEmailVerification(user);

        // 登録直後は強制的にログアウトさせ、メールを見に行かせる
        await signOut(auth);

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// 🚪 ログアウト処理
export async function logoutFromUniverse() {
    await signOut(auth);
}