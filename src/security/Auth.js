// src/security/Auth.js

// Firebase公式から必要な部品をインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
// ★ createUserWithEmailAndPassword を追加して新規登録できるようにしました
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// あなたのAPIキー
const firebaseConfig = {
  apiKey: "AIzaSyDjr1e3AYjQ7ZGqagb23HWqMdGjZaYcAmU",
  authDomain: "my-universe-os.firebaseapp.com",
  projectId: "my-universe-os",
  storageBucket: "my-universe-os.firebasestorage.app",
  messagingSenderId: "190319305708",
  appId: "1:190319305708:web:0dd89920ad6b9e2f1416c9",
  measurementId: "G-VGBNGHQZWD"
};

// Firebaseの起動
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 🔵 ログイン処理の関数
export async function loginToUniverse(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("Login Error:", error.code);
        return { success: false, error: error.message };
    }
}

// 🟢 新設！新規登録（アカウント作成）処理の関数
export async function createUniverseAccount(email, password) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("Signup Error:", error.code);
        return { success: false, error: error.message };
    }
}