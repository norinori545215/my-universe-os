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

export async function loginWithGoogle(rememberMe) {
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        const result = await signInWithPopup(auth, googleProvider);
        await saveUserProfile(result.user, result.user.displayName);
        return { success: true, user: result.user };
    } catch (error) {
        return { success: false, error: "Googleログインにキャンセルされたか、失敗しました。" };
    }
}

export async function loginToUniverse(email, password, rememberMe) {
    try {
        const persistence = rememberMe ? browserLocalPersistence : browserSessionPersistence;
        await setPersistence(auth, persistence);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
            await signOut(auth);
            return { success: false, error: "⚠️ メールの確認が完了していません。\nご自身のメールの受信トレイを開き、届いているリンクをクリックしてから再度ログインしてください。" };
        }
        return { success: true, user: userCredential.user };
    } catch (error) {
        let msg = "ログインに失敗しました。アドレスかパスワードが違います。";
        if (error.code === 'auth/too-many-requests') msg = "失敗が多すぎます。しばらく待ってからやり直してください。";
        return { success: false, error: msg };
    }
}

export async function createUniverseAccount(email, password, userName) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await updateProfile(user, { displayName: userName });
        await saveUserProfile(user, userName);
        await sendEmailVerification(user);
        await signOut(auth);
        return { success: true };
    } catch (error) {
        // ★ 英語のエラーを分かりやすい日本語に翻訳して返す！
        let msg = "エラーが発生しました。";
        if (error.code === 'auth/email-already-in-use') {
            msg = "このメールアドレスは既に登録されています！\n下の「ログイン画面に戻る」を押して、ログインしてください。";
        } else if (error.code === 'auth/invalid-email') {
            msg = "メールアドレスの形式が正しくありません。";
        } else if (error.code === 'auth/weak-password') {
            msg = "パスワードが弱すぎます。6文字以上で設定してください。";
        }
        return { success: false, error: msg };
    }
}

export async function logoutFromUniverse() {
    await signOut(auth);
}