// Firebase公式から必要な部品をインポート
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ★ここをご自身のFirebaseコンソールで取得した内容に書き換えてください！
const firebaseConfig = {
    apiKey: "AIzaSyB-xxxxxxxxxxxxxxx",
    authDomain: "my-universe-os.firebaseapp.com",
    projectId: "my-universe-os",
    storageBucket: "my-universe-os.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdefg..."
};

// Firebaseの起動
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ログイン処理の関数
export async function loginToUniverse(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        console.error("Login Error:", error.code);
        return { success: false, error: error.message };
    }
}