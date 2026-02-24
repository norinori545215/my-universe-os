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
    sendEmailVerification,
    GoogleAuthProvider, // ★追加: Googleログイン用
    signInWithPopup     // ★追加: Googleログインのポップアップ画面用
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// ★追加: データベースにユーザー情報を保存するための機能
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
const googleProvider = new GoogleAuthProvider(); // ★Googleログインの準備

// ユーザー情報をデータベースに保存・確認する共通関数
async function saveUserProfile(user, userName) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        // 初回登録時のみ、データベースに「無料プラン(free)」として記録する！
        await setDoc(userRef, {
            name: userName || user.displayName || "名無し",
            email: user.email,
            plan: "free", // 👑 管理者（あなた）が後からここを "premium" に書き換えられます
            createdAt: new Date().toISOString()
        });
    }
}

// 🟡 新設！Googleでログイン（＆自動登録）
export async function loginWithGoogle(rememberMe) {
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        const result = await signInWithPopup(auth, googleProvider);
        await saveUserProfile(result.user, result.user.displayName); // DBにプランを記録
        
        return { success: true, user: result.user };
    } catch (error) {
        return { success: false, error: "Googleログインに失敗しました: " + error.message };
    }
}

// 🔵 ログイン処理（既存のメアド用）
export async function loginToUniverse(email, password, rememberMe) {
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);

        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            return { success: false, error: "メールの確認が完了していません。\n受信トレイのリンクをクリックしてください。" };
        }

        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: "ログインに失敗しました。アドレスかパスワードが違います。" };
    }
}

// 🟢 新規登録処理（既存のメアド用）
export async function createUniverseAccount(email, password, userName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: userName });
        await saveUserProfile(user, userName); // DBにプランを記録
        await sendEmailVerification(user);
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